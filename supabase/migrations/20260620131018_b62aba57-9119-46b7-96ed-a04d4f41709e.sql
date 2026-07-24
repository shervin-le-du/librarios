-- 1. Add status to staff_users
ALTER TABLE public.staff_users 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Backfill: earliest staff user becomes owner, others librarian; all active
UPDATE public.staff_users SET status = 'active' WHERE status IS NULL OR status = '';

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY library_id ORDER BY created_at ASC) rn
  FROM public.staff_users
)
UPDATE public.staff_users s
SET role = CASE WHEN r.rn = 1 THEN 'owner' ELSE 'librarian' END
FROM ranked r
WHERE s.id = r.id;

-- 2. Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'librarian' CHECK (role IN ('owner','librarian')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_by uuid REFERENCES public.staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 3. Helper: is_owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE id = auth.uid() AND role = 'owner' AND status = 'active'
  );
$$;

-- 4. Invitation policies — owners manage invitations in their library
CREATE POLICY "owners read invitations" ON public.invitations
  FOR SELECT TO authenticated
  USING (library_id = public.get_user_library_id() AND public.is_owner());

CREATE POLICY "owners create invitations" ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (library_id = public.get_user_library_id() AND public.is_owner());

CREATE POLICY "owners update invitations" ON public.invitations
  FOR UPDATE TO authenticated
  USING (library_id = public.get_user_library_id() AND public.is_owner())
  WITH CHECK (library_id = public.get_user_library_id() AND public.is_owner());

CREATE POLICY "owners delete invitations" ON public.invitations
  FOR DELETE TO authenticated
  USING (library_id = public.get_user_library_id() AND public.is_owner());

-- 5. staff_users extra policies — owners can see and update staff in their library
CREATE POLICY "owners read library staff" ON public.staff_users
  FOR SELECT TO authenticated
  USING (library_id = public.get_user_library_id() AND public.is_owner());

CREATE POLICY "owners update library staff" ON public.staff_users
  FOR UPDATE TO authenticated
  USING (library_id = public.get_user_library_id() AND public.is_owner())
  WITH CHECK (library_id = public.get_user_library_id() AND public.is_owner());

-- 6. Public token lookup (anon-safe): exposes only email/role/library_name
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE(email text, role text, library_name text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.email, i.role, l.name, i.status
  FROM public.invitations i
  JOIN public.libraries l ON l.id = i.library_id
  WHERE i.token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

-- 7. Updated handle_new_user — honors invitation_token in user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  lib_id uuid;
  v_role text;
  v_status text := 'active';
  v_token text;
  v_invite RECORD;
  v_existing_owner uuid;
BEGIN
  v_token := NEW.raw_user_meta_data->>'invitation_token';

  IF v_token IS NOT NULL AND v_token <> '' THEN
    SELECT * INTO v_invite FROM public.invitations
      WHERE token = v_token AND status = 'pending'
      LIMIT 1;
    IF v_invite.id IS NOT NULL THEN
      lib_id := v_invite.library_id;
      v_role := v_invite.role;
      UPDATE public.invitations SET status = 'accepted' WHERE id = v_invite.id;
    END IF;
  END IF;

  IF lib_id IS NULL THEN
    SELECT id INTO lib_id FROM public.libraries ORDER BY created_at ASC LIMIT 1;
    -- First staff in library becomes owner; otherwise librarian
    SELECT id INTO v_existing_owner FROM public.staff_users
      WHERE library_id = lib_id AND role = 'owner' LIMIT 1;
    v_role := CASE WHEN v_existing_owner IS NULL THEN 'owner' ELSE 'librarian' END;
  END IF;

  INSERT INTO public.staff_users (id, library_id, email, full_name, role, status)
  VALUES (NEW.id, lib_id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
          v_role, v_status);
  RETURN NEW;
END $$;

-- 8. Helper to fetch current staff record (used by app)
CREATE OR REPLACE FUNCTION public.get_current_staff()
RETURNS TABLE(id uuid, library_id uuid, email text, full_name text, role text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, library_id, email, full_name, role, status
  FROM public.staff_users WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_staff() TO authenticated;