
-- LIBRARIES
CREATE TABLE public.libraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.libraries TO authenticated;
GRANT ALL ON public.libraries TO service_role;
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;

INSERT INTO public.libraries (name) VALUES ('Demo Library');

-- STAFF USERS
CREATE TABLE public.staff_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  library_id uuid NOT NULL REFERENCES public.libraries(id),
  email text,
  full_name text,
  role text NOT NULL DEFAULT 'librarian',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.staff_users TO authenticated;
GRANT ALL ON public.staff_users TO service_role;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read own row" ON public.staff_users
  FOR SELECT TO authenticated USING (id = auth.uid());

-- helper to get current user's library
CREATE OR REPLACE FUNCTION public.get_user_library_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT library_id FROM public.staff_users WHERE id = auth.uid()
$$;

CREATE POLICY "libraries: read own" ON public.libraries
  FOR SELECT TO authenticated USING (id = public.get_user_library_id());

-- Auto-create staff user on signup, attach to demo library
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lib_id uuid;
BEGIN
  SELECT id INTO lib_id FROM public.libraries ORDER BY created_at ASC LIMIT 1;
  INSERT INTO public.staff_users (id, library_id, email, full_name)
  VALUES (NEW.id, lib_id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- READERS
CREATE TABLE public.readers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.libraries(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  address text,
  id_document_type text,
  id_document_number text,
  membership_number text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (library_id, membership_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.readers TO authenticated;
GRANT ALL ON public.readers TO service_role;
ALTER TABLE public.readers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "readers: staff library access" ON public.readers
  FOR ALL TO authenticated
  USING (library_id = public.get_user_library_id())
  WITH CHECK (library_id = public.get_user_library_id());

-- Auto membership number
CREATE OR REPLACE FUNCTION public.set_membership_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NEW.membership_number IS NULL OR NEW.membership_number = '' THEN
    SELECT COUNT(*) + 1 INTO n FROM public.readers WHERE library_id = NEW.library_id;
    NEW.membership_number := 'MEM-' || lpad(n::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER readers_set_membership_number
BEFORE INSERT ON public.readers
FOR EACH ROW EXECUTE FUNCTION public.set_membership_number();

-- BOOKS
CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.libraries(id),
  title text NOT NULL,
  author text,
  isbn text,
  language text,
  category text,
  availability_status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books: staff library access" ON public.books
  FOR ALL TO authenticated
  USING (library_id = public.get_user_library_id())
  WITH CHECK (library_id = public.get_user_library_id());

-- LOANS
CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.libraries(id),
  book_id uuid NOT NULL REFERENCES public.books(id),
  reader_id uuid NOT NULL REFERENCES public.readers(id),
  checked_out_at timestamptz NOT NULL DEFAULT now(),
  due_date date NOT NULL,
  returned_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loans: staff library access" ON public.loans
  FOR ALL TO authenticated
  USING (library_id = public.get_user_library_id())
  WITH CHECK (library_id = public.get_user_library_id());

-- ATOMIC CHECKOUT
CREATE OR REPLACE FUNCTION public.checkout_book(p_book_id uuid, p_reader_id uuid, p_due_date date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lib_id uuid; new_loan_id uuid; book_status text; book_lib uuid; reader_lib uuid;
BEGIN
  lib_id := public.get_user_library_id();
  IF lib_id IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT availability_status, library_id INTO book_status, book_lib FROM public.books WHERE id = p_book_id FOR UPDATE;
  IF book_lib IS NULL OR book_lib <> lib_id THEN RAISE EXCEPTION 'Book not found'; END IF;
  IF book_status <> 'available' THEN RAISE EXCEPTION 'Book is not available'; END IF;

  SELECT library_id INTO reader_lib FROM public.readers WHERE id = p_reader_id;
  IF reader_lib IS NULL OR reader_lib <> lib_id THEN RAISE EXCEPTION 'Reader not found'; END IF;

  INSERT INTO public.loans (library_id, book_id, reader_id, due_date)
  VALUES (lib_id, p_book_id, p_reader_id, p_due_date)
  RETURNING id INTO new_loan_id;

  UPDATE public.books SET availability_status = 'on_loan' WHERE id = p_book_id;
  RETURN new_loan_id;
END $$;

GRANT EXECUTE ON FUNCTION public.checkout_book(uuid, uuid, date) TO authenticated;

-- ATOMIC RETURN
CREATE OR REPLACE FUNCTION public.return_loan(p_loan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lib_id uuid; v_book_id uuid; v_loan_lib uuid; v_status text;
BEGIN
  lib_id := public.get_user_library_id();
  IF lib_id IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT book_id, library_id, status INTO v_book_id, v_loan_lib, v_status
  FROM public.loans WHERE id = p_loan_id FOR UPDATE;

  IF v_loan_lib IS NULL OR v_loan_lib <> lib_id THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'Loan is not active'; END IF;

  UPDATE public.loans SET status = 'returned', returned_at = now() WHERE id = p_loan_id;
  UPDATE public.books SET availability_status = 'available' WHERE id = v_book_id;
END $$;

GRANT EXECUTE ON FUNCTION public.return_loan(uuid) TO authenticated;
