-- 1. Library settings columns
ALTER TABLE public.libraries
  ADD COLUMN IF NOT EXISTS languages text[],
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_address text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS brand_color text;

-- 2. Owners can update their library row
DROP POLICY IF EXISTS "owners update own library" ON public.libraries;
CREATE POLICY "owners update own library" ON public.libraries
  FOR UPDATE TO authenticated
  USING (id = public.get_user_library_id() AND public.is_owner())
  WITH CHECK (id = public.get_user_library_id() AND public.is_owner());

-- 3. RPC: create a fresh library for the current user (becomes owner)
CREATE OR REPLACE FUNCTION public.create_library_for_current_user(p_name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user uuid; v_lib uuid; v_email text; v_name text;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Library name is required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.staff_users WHERE id = v_user) THEN
    RAISE EXCEPTION 'You already belong to a library';
  END IF;

  SELECT email, raw_user_meta_data->>'full_name'
    INTO v_email, v_name
    FROM auth.users WHERE id = v_user;

  INSERT INTO public.libraries (name) VALUES (trim(p_name)) RETURNING id INTO v_lib;
  INSERT INTO public.staff_users (id, library_id, email, full_name, role, status)
    VALUES (v_user, v_lib, v_email, COALESCE(v_name, v_email), 'owner', 'active');
  RETURN v_lib;
END $$;

GRANT EXECUTE ON FUNCTION public.create_library_for_current_user(text) TO authenticated;

-- 4. Updated handle_new_user — only attach via invitation; otherwise leave to onboarding
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_token text; v_invite RECORD;
BEGIN
  v_token := NEW.raw_user_meta_data->>'invitation_token';
  IF v_token IS NULL OR v_token = '' THEN
    RETURN NEW; -- onboarding flow will create the library
  END IF;

  SELECT * INTO v_invite FROM public.invitations
    WHERE token = v_token AND status = 'pending' LIMIT 1;
  IF v_invite.id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.staff_users (id, library_id, email, full_name, role, status)
  VALUES (NEW.id, v_invite.library_id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
          v_invite.role, 'active');
  UPDATE public.invitations SET status = 'accepted' WHERE id = v_invite.id;
  RETURN NEW;
END $$;

-- 5. Storage policies for library-logos bucket (bucket itself created via tool)
-- Public read so logo_url works as a plain <img src>
DROP POLICY IF EXISTS "library logos public read" ON storage.objects;
CREATE POLICY "library logos public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'library-logos');

-- Owners can upload/replace/delete logos inside their own library's folder
DROP POLICY IF EXISTS "owners write own library logo" ON storage.objects;
CREATE POLICY "owners write own library logo" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'library-logos'
    AND public.is_owner()
    AND (storage.foldername(name))[1] = public.get_user_library_id()::text
  );

DROP POLICY IF EXISTS "owners update own library logo" ON storage.objects;
CREATE POLICY "owners update own library logo" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'library-logos'
    AND public.is_owner()
    AND (storage.foldername(name))[1] = public.get_user_library_id()::text
  );

DROP POLICY IF EXISTS "owners delete own library logo" ON storage.objects;
CREATE POLICY "owners delete own library logo" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'library-logos'
    AND public.is_owner()
    AND (storage.foldername(name))[1] = public.get_user_library_id()::text
  );