
-- 1. Book condition
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'in_circulation';

ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_condition_check;
ALTER TABLE public.books
  ADD CONSTRAINT books_condition_check
  CHECK (condition IN ('in_circulation','lost','damaged','withdrawn'));

-- 2. Reservations table
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  reader_id uuid NOT NULL REFERENCES public.readers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','fulfilled','cancelled','expired')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- At most one active hold per book
CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_active_per_book
  ON public.reservations(book_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS reservations_library_idx ON public.reservations(library_id);
CREATE INDEX IF NOT EXISTS reservations_reader_idx ON public.reservations(reader_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservations: staff library access" ON public.reservations;
CREATE POLICY "reservations: staff library access"
  ON public.reservations
  FOR ALL
  TO authenticated
  USING (library_id = public.get_user_library_id())
  WITH CHECK (library_id = public.get_user_library_id());

-- 3. Updated checkout RPC — enforces condition, reader status, reservations
CREATE OR REPLACE FUNCTION public.checkout_book(p_book_id uuid, p_reader_id uuid, p_due_date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lib_id uuid;
  new_loan_id uuid;
  book_status text;
  book_cond text;
  book_lib uuid;
  reader_lib uuid;
  reader_status text;
  v_res_id uuid;
  v_res_reader uuid;
  v_res_reader_name text;
BEGIN
  lib_id := public.get_user_library_id();
  IF lib_id IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT availability_status, condition, library_id
    INTO book_status, book_cond, book_lib
    FROM public.books WHERE id = p_book_id FOR UPDATE;
  IF book_lib IS NULL OR book_lib <> lib_id THEN RAISE EXCEPTION 'Book not found'; END IF;
  IF book_cond <> 'in_circulation' THEN
    RAISE EXCEPTION 'Book is not in circulation (%)' , book_cond;
  END IF;
  IF book_status <> 'available' THEN RAISE EXCEPTION 'Book is not available'; END IF;

  SELECT library_id, status INTO reader_lib, reader_status
    FROM public.readers WHERE id = p_reader_id;
  IF reader_lib IS NULL OR reader_lib <> lib_id THEN RAISE EXCEPTION 'Reader not found'; END IF;
  IF reader_status = 'suspended' THEN RAISE EXCEPTION 'Reader is suspended'; END IF;

  -- Check for active reservation
  SELECT r.id, r.reader_id, rd.first_name || ' ' || rd.last_name
    INTO v_res_id, v_res_reader, v_res_reader_name
    FROM public.reservations r
    JOIN public.readers rd ON rd.id = r.reader_id
    WHERE r.book_id = p_book_id AND r.status = 'active'
    LIMIT 1;

  IF v_res_id IS NOT NULL AND v_res_reader <> p_reader_id THEN
    RAISE EXCEPTION 'Reserved for % — cancel the hold to lend to someone else', v_res_reader_name;
  END IF;

  INSERT INTO public.loans (library_id, book_id, reader_id, due_date)
  VALUES (lib_id, p_book_id, p_reader_id, p_due_date)
  RETURNING id INTO new_loan_id;

  UPDATE public.books SET availability_status = 'on_loan' WHERE id = p_book_id;

  IF v_res_id IS NOT NULL AND v_res_reader = p_reader_id THEN
    UPDATE public.reservations SET status = 'fulfilled' WHERE id = v_res_id;
  END IF;

  RETURN new_loan_id;
END $$;

-- 4. Place reservation
CREATE OR REPLACE FUNCTION public.place_reservation(p_book_id uuid, p_reader_id uuid, p_expires_at timestamptz DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lib_id uuid;
  book_lib uuid;
  book_cond text;
  reader_lib uuid;
  reader_status text;
  new_id uuid;
BEGIN
  lib_id := public.get_user_library_id();
  IF lib_id IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT library_id, condition INTO book_lib, book_cond
    FROM public.books WHERE id = p_book_id;
  IF book_lib IS NULL OR book_lib <> lib_id THEN RAISE EXCEPTION 'Book not found'; END IF;
  IF book_cond <> 'in_circulation' THEN RAISE EXCEPTION 'Book is not in circulation'; END IF;

  SELECT library_id, status INTO reader_lib, reader_status
    FROM public.readers WHERE id = p_reader_id;
  IF reader_lib IS NULL OR reader_lib <> lib_id THEN RAISE EXCEPTION 'Reader not found'; END IF;
  IF reader_status = 'suspended' THEN RAISE EXCEPTION 'Reader is suspended'; END IF;

  IF EXISTS (SELECT 1 FROM public.reservations WHERE book_id = p_book_id AND status = 'active') THEN
    RAISE EXCEPTION 'This book already has an active hold';
  END IF;

  INSERT INTO public.reservations (library_id, book_id, reader_id, expires_at)
  VALUES (lib_id, p_book_id, p_reader_id, p_expires_at)
  RETURNING id INTO new_id;

  RETURN new_id;
END $$;

-- 5. Cancel reservation
CREATE OR REPLACE FUNCTION public.cancel_reservation(p_reservation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE lib_id uuid; v_lib uuid; v_status text;
BEGIN
  lib_id := public.get_user_library_id();
  IF lib_id IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT library_id, status INTO v_lib, v_status FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF v_lib IS NULL OR v_lib <> lib_id THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'Reservation is not active'; END IF;
  UPDATE public.reservations SET status = 'cancelled' WHERE id = p_reservation_id;
END $$;

-- 6. Set book condition
CREATE OR REPLACE FUNCTION public.set_book_condition(p_book_id uuid, p_condition text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE lib_id uuid; v_lib uuid;
BEGIN
  lib_id := public.get_user_library_id();
  IF lib_id IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_condition NOT IN ('in_circulation','lost','damaged','withdrawn') THEN
    RAISE EXCEPTION 'Invalid condition';
  END IF;
  SELECT library_id INTO v_lib FROM public.books WHERE id = p_book_id;
  IF v_lib IS NULL OR v_lib <> lib_id THEN RAISE EXCEPTION 'Book not found'; END IF;
  UPDATE public.books SET condition = p_condition WHERE id = p_book_id;
END $$;

-- 7. Set reader status (suspend / reactivate)
CREATE OR REPLACE FUNCTION public.set_reader_status(p_reader_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE lib_id uuid; v_lib uuid;
BEGIN
  lib_id := public.get_user_library_id();
  IF lib_id IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT library_id INTO v_lib FROM public.readers WHERE id = p_reader_id;
  IF v_lib IS NULL OR v_lib <> lib_id THEN RAISE EXCEPTION 'Reader not found'; END IF;
  UPDATE public.readers SET status = p_status WHERE id = p_reader_id;
END $$;
