
-- 1. member_invitations table
CREATE TABLE IF NOT EXISTS public.member_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  reader_id uuid NOT NULL REFERENCES public.readers(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_member_invitations_reader ON public.member_invitations(reader_id);
CREATE INDEX IF NOT EXISTS idx_member_invitations_library ON public.member_invitations(library_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_invitations TO authenticated;
GRANT ALL ON public.member_invitations TO service_role;

ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view their library's member invitations"
  ON public.member_invitations FOR SELECT TO authenticated
  USING (public.has_capability(library_id, 'manage_readers'));

CREATE POLICY "Staff can manage their library's member invitations"
  ON public.member_invitations FOR ALL TO authenticated
  USING (public.has_capability(library_id, 'manage_readers'))
  WITH CHECK (public.has_capability(library_id, 'manage_readers'));

-- 2. Expand the public home RPC to expose the portal flag
DROP FUNCTION IF EXISTS public.get_library_public_home(text);
CREATE OR REPLACE FUNCTION public.get_library_public_home(p_slug text)
  RETURNS TABLE(
    id uuid, name text, subdomain text, logo_url text, brand_color text,
    languages text[], contact_email text, contact_phone text, contact_address text,
    home_page_config jsonb, status text, patron_portal_enabled boolean
  )
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, subdomain, logo_url, brand_color, languages,
         contact_email, contact_phone, contact_address, home_page_config, status,
         patron_portal_enabled
  FROM public.libraries
  WHERE subdomain = lower(p_slug)
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_library_public_home(text) TO anon, authenticated;

-- 3. Create a member invitation (staff)
CREATE OR REPLACE FUNCTION public.create_member_invitation(p_reader_id uuid)
  RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_lib uuid;
  v_reader_lib uuid;
  v_reader_auth uuid;
  v_portal boolean;
  v_token text;
BEGIN
  v_lib := public.get_user_library_id();
  IF v_lib IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.has_capability(v_lib, 'manage_readers') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT library_id, auth_user_id INTO v_reader_lib, v_reader_auth
    FROM public.readers WHERE id = p_reader_id;
  IF v_reader_lib IS NULL OR v_reader_lib <> v_lib THEN
    RAISE EXCEPTION 'Reader not found';
  END IF;
  IF v_reader_auth IS NOT NULL THEN
    RAISE EXCEPTION 'This reader already has a login';
  END IF;

  SELECT patron_portal_enabled INTO v_portal FROM public.libraries WHERE id = v_lib;
  IF NOT COALESCE(v_portal, false) THEN
    RAISE EXCEPTION 'Member portal is not enabled for this library';
  END IF;

  -- Revoke any existing pending invites for this reader
  UPDATE public.member_invitations
     SET status = 'revoked'
   WHERE reader_id = p_reader_id AND status = 'pending';

  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

  INSERT INTO public.member_invitations (library_id, reader_id, token, created_by, expires_at)
  VALUES (v_lib, p_reader_id, v_token, auth.uid(), now() + interval '14 days');

  RETURN v_token;
END $$;
GRANT EXECUTE ON FUNCTION public.create_member_invitation(uuid) TO authenticated;

-- 4. Revoke a pending invitation (staff)
CREATE OR REPLACE FUNCTION public.revoke_member_invitation(p_invitation_id uuid)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_lib uuid; v_inv_lib uuid; v_status text;
BEGIN
  v_lib := public.get_user_library_id();
  IF v_lib IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT library_id, status INTO v_inv_lib, v_status
    FROM public.member_invitations WHERE id = p_invitation_id;
  IF v_inv_lib IS NULL OR v_inv_lib <> v_lib THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF NOT public.has_capability(v_lib, 'manage_readers') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_status <> 'pending' THEN RETURN; END IF;
  UPDATE public.member_invitations SET status = 'revoked' WHERE id = p_invitation_id;
END $$;
GRANT EXECUTE ON FUNCTION public.revoke_member_invitation(uuid) TO authenticated;

-- 5. Disable an active member's login (staff)
CREATE OR REPLACE FUNCTION public.disable_member_login(p_reader_id uuid)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_lib uuid; v_reader_lib uuid;
BEGIN
  v_lib := public.get_user_library_id();
  IF v_lib IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.has_capability(v_lib, 'manage_readers') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT library_id INTO v_reader_lib FROM public.readers WHERE id = p_reader_id;
  IF v_reader_lib IS NULL OR v_reader_lib <> v_lib THEN
    RAISE EXCEPTION 'Reader not found';
  END IF;
  UPDATE public.readers SET auth_user_id = NULL WHERE id = p_reader_id;
  UPDATE public.member_invitations
     SET status = 'revoked'
   WHERE reader_id = p_reader_id AND status = 'pending';
END $$;
GRANT EXECUTE ON FUNCTION public.disable_member_login(uuid) TO authenticated;

-- 6. Preview an invitation by token (open — needs the secret token)
CREATE OR REPLACE FUNCTION public.get_member_invitation_preview(p_token text)
  RETURNS TABLE(
    library_name text, library_slug text, reader_first_name text,
    reader_last_name text, status text, expired boolean, portal_enabled boolean
  )
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.name, l.subdomain, r.first_name, r.last_name, i.status,
         (i.expires_at IS NOT NULL AND i.expires_at < now()),
         COALESCE(l.patron_portal_enabled, false)
  FROM public.member_invitations i
  JOIN public.libraries l ON l.id = i.library_id
  JOIN public.readers r ON r.id = i.reader_id
  WHERE i.token = p_token
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_member_invitation_preview(text) TO anon, authenticated;

-- 7. Link the currently signed-in user to the invitation's reader
CREATE OR REPLACE FUNCTION public.link_member_account(p_token text)
  RETURNS TABLE(library_slug text, reader_id uuid)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_inv RECORD;
  v_existing uuid;
  v_portal boolean;
  v_slug text;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT i.id, i.library_id, i.reader_id, i.status, i.expires_at
    INTO v_inv
    FROM public.member_invitations i
    WHERE i.token = p_token
    FOR UPDATE;

  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'This invitation is no longer valid'; END IF;
  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'This invitation has expired';
  END IF;

  SELECT patron_portal_enabled, subdomain INTO v_portal, v_slug
    FROM public.libraries WHERE id = v_inv.library_id;
  IF NOT COALESCE(v_portal, false) THEN
    RAISE EXCEPTION 'Member portal is not enabled for this library';
  END IF;

  -- Caller must not already belong to another reader in this library
  SELECT id INTO v_existing FROM public.readers
    WHERE library_id = v_inv.library_id AND auth_user_id = v_user;
  IF v_existing IS NOT NULL AND v_existing <> v_inv.reader_id THEN
    RAISE EXCEPTION 'This account is already linked to another reader in this library';
  END IF;

  -- Caller must not already be a staff member of this library
  IF EXISTS (SELECT 1 FROM public.staff_users WHERE id = v_user AND library_id = v_inv.library_id) THEN
    RAISE EXCEPTION 'Staff accounts cannot be used as member accounts';
  END IF;

  -- Reader must not already be linked to a different account
  SELECT auth_user_id INTO v_existing FROM public.readers WHERE id = v_inv.reader_id;
  IF v_existing IS NOT NULL AND v_existing <> v_user THEN
    RAISE EXCEPTION 'This reader is already linked to another account';
  END IF;

  UPDATE public.readers SET auth_user_id = v_user WHERE id = v_inv.reader_id;
  UPDATE public.member_invitations SET status = 'accepted' WHERE id = v_inv.id;

  library_slug := v_slug;
  reader_id := v_inv.reader_id;
  RETURN NEXT;
END $$;
GRANT EXECUTE ON FUNCTION public.link_member_account(text) TO authenticated;

-- 8. Member self-service: renew an active loan (+14 days, max 60 days from checkout, no active hold by someone else)
CREATE OR REPLACE FUNCTION public.renew_member_loan(p_loan_id uuid)
  RETURNS date
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reader uuid;
  v_loan RECORD;
  v_new_due date;
  v_portal boolean;
BEGIN
  v_reader := public.current_user_reader_id();
  IF v_reader IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT id, library_id, book_id, reader_id, due_date, checked_out_at, status
    INTO v_loan
    FROM public.loans WHERE id = p_loan_id FOR UPDATE;
  IF v_loan.id IS NULL OR v_loan.reader_id <> v_reader THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;

  SELECT patron_portal_enabled INTO v_portal FROM public.libraries WHERE id = v_loan.library_id;
  IF NOT COALESCE(v_portal, false) THEN RAISE EXCEPTION 'Member portal is not enabled'; END IF;

  IF v_loan.status <> 'active' THEN RAISE EXCEPTION 'Loan is not active'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.reservations
    WHERE book_id = v_loan.book_id AND status = 'active' AND reader_id <> v_reader
  ) THEN
    RAISE EXCEPTION 'Cannot renew — another reader has a hold on this book';
  END IF;

  v_new_due := GREATEST(v_loan.due_date, current_date) + 14;
  IF v_new_due > (v_loan.checked_out_at::date + 60) THEN
    RAISE EXCEPTION 'Cannot renew — maximum lending period reached';
  END IF;

  UPDATE public.loans SET due_date = v_new_due WHERE id = p_loan_id;
  RETURN v_new_due;
END $$;
GRANT EXECUTE ON FUNCTION public.renew_member_loan(uuid) TO authenticated;

-- 9. Member self-service: cancel own active reservation
CREATE OR REPLACE FUNCTION public.cancel_member_reservation(p_reservation_id uuid)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_reader uuid; v_res RECORD; v_portal boolean;
BEGIN
  v_reader := public.current_user_reader_id();
  IF v_reader IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT id, library_id, reader_id, status INTO v_res
    FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF v_res.id IS NULL OR v_res.reader_id <> v_reader THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  SELECT patron_portal_enabled INTO v_portal FROM public.libraries WHERE id = v_res.library_id;
  IF NOT COALESCE(v_portal, false) THEN RAISE EXCEPTION 'Member portal is not enabled'; END IF;
  IF v_res.status <> 'active' THEN RAISE EXCEPTION 'Reservation is not active'; END IF;
  UPDATE public.reservations SET status = 'cancelled' WHERE id = p_reservation_id;
END $$;
GRANT EXECUTE ON FUNCTION public.cancel_member_reservation(uuid) TO authenticated;

-- 10. Member self-service: full loan list with book info (RLS already restricts rows)
CREATE OR REPLACE FUNCTION public.get_my_member_dashboard(p_slug text)
  RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_lib_id uuid;
  v_portal boolean;
  v_reader RECORD;
  v_loans jsonb;
  v_holds jsonb;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, patron_portal_enabled INTO v_lib_id, v_portal
    FROM public.libraries WHERE subdomain = lower(p_slug);
  IF v_lib_id IS NULL THEN RAISE EXCEPTION 'Library not found'; END IF;
  IF NOT COALESCE(v_portal, false) THEN RAISE EXCEPTION 'Member portal is not enabled'; END IF;

  SELECT * INTO v_reader FROM public.readers
    WHERE library_id = v_lib_id AND auth_user_id = v_user;
  IF v_reader.id IS NULL THEN RAISE EXCEPTION 'No member account in this library'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', l.id, 'book_id', l.book_id, 'book_title', b.title, 'book_author', b.author,
      'checked_out_at', l.checked_out_at, 'due_date', l.due_date,
      'returned_at', l.returned_at, 'status', l.status
    ) ORDER BY l.checked_out_at DESC), '[]'::jsonb)
    INTO v_loans
    FROM public.loans l JOIN public.books b ON b.id = l.book_id
    WHERE l.reader_id = v_reader.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', r.id, 'book_id', r.book_id, 'book_title', b.title, 'book_author', b.author,
      'created_at', r.created_at, 'expires_at', r.expires_at, 'status', r.status
    ) ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v_holds
    FROM public.reservations r JOIN public.books b ON b.id = r.book_id
    WHERE r.reader_id = v_reader.id;

  RETURN jsonb_build_object(
    'reader', to_jsonb(v_reader),
    'loans', v_loans,
    'holds', v_holds
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_my_member_dashboard(text) TO authenticated;

-- 11. Member-status preview for the reader detail page (staff)
CREATE OR REPLACE FUNCTION public.get_reader_member_status(p_reader_id uuid)
  RETURNS TABLE(has_login boolean, pending_invitation_id uuid, pending_token text, pending_expires_at timestamptz)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_lib uuid; v_reader_lib uuid; v_auth uuid;
BEGIN
  v_lib := public.get_user_library_id();
  SELECT library_id, auth_user_id INTO v_reader_lib, v_auth FROM public.readers WHERE id = p_reader_id;
  IF v_reader_lib IS NULL OR v_reader_lib <> v_lib THEN RETURN; END IF;
  has_login := v_auth IS NOT NULL;
  SELECT id, token, expires_at INTO pending_invitation_id, pending_token, pending_expires_at
    FROM public.member_invitations
    WHERE reader_id = p_reader_id AND status = 'pending'
    ORDER BY created_at DESC LIMIT 1;
  RETURN NEXT;
END $$;
GRANT EXECUTE ON FUNCTION public.get_reader_member_status(uuid) TO authenticated;
