
-- Library owner invitations (invite a person to own a new library)
CREATE TABLE public.library_owner_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_owner_invitations TO authenticated;
GRANT ALL ON public.library_owner_invitations TO service_role;
ALTER TABLE public.library_owner_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins read owner invitations"
  ON public.library_owner_invitations FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "platform admins write owner invitations"
  ON public.library_owner_invitations FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE INDEX idx_library_owner_invitations_token ON public.library_owner_invitations(token);
CREATE INDEX idx_library_owner_invitations_library ON public.library_owner_invitations(library_id);

-- Platform admin invitations (invite a user to become a platform admin/super admin)
CREATE TABLE public.platform_admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin','platform_admin')),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_admin_invitations TO authenticated;
GRANT ALL ON public.platform_admin_invitations TO service_role;
ALTER TABLE public.platform_admin_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins read admin invitations"
  ON public.platform_admin_invitations FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "super admins write admin invitations"
  ON public.platform_admin_invitations FOR ALL TO authenticated
  USING (public.is_platform_super_admin())
  WITH CHECK (public.is_platform_super_admin());

CREATE INDEX idx_platform_admin_invitations_token ON public.platform_admin_invitations(token);

-- Helper to make a URL-safe token
CREATE OR REPLACE FUNCTION public._make_invite_token()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT replace(replace(replace(encode(gen_random_bytes(24),'base64'),'+','-'),'/','_'),'=','');
$$;

-- Invite a new library owner (creates suspended library + invitation)
CREATE OR REPLACE FUNCTION public.platform_invite_library_owner(p_name text, p_slug text, p_email text)
RETURNS TABLE(invitation_id uuid, token text, library_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_slug text; v_email text; v_lib uuid; v_token text; v_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'Library name is required'; END IF;
  v_email := lower(trim(coalesce(p_email,'')));
  IF v_email = '' OR v_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN RAISE EXCEPTION 'Valid email required'; END IF;
  v_slug := lower(trim(coalesce(p_slug,'')));
  IF length(v_slug) < 3 OR length(v_slug) > 30 THEN RAISE EXCEPTION 'Slug must be 3-30 characters'; END IF;
  IF v_slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' THEN
    RAISE EXCEPTION 'Slug may only contain lowercase letters, numbers, and hyphens';
  END IF;
  IF v_slug = ANY(ARRAY['www','app','api','admin','mail','static','assets','auth','login','signup','dashboard','support','onboarding','accept-invite','platform']) THEN
    RAISE EXCEPTION 'That slug is reserved';
  END IF;
  IF EXISTS (SELECT 1 FROM public.libraries WHERE subdomain = v_slug) THEN
    RAISE EXCEPTION 'That slug is already taken';
  END IF;

  INSERT INTO public.libraries (name, subdomain, status) VALUES (trim(p_name), v_slug, 'suspended') RETURNING id INTO v_lib;

  v_token := public._make_invite_token();
  INSERT INTO public.library_owner_invitations (library_id, email, token, invited_by)
  VALUES (v_lib, v_email, v_token, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', v_lib, 'platform.invite_library_owner',
          jsonb_build_object('email', v_email, 'slug', v_slug));

  invitation_id := v_id; token := v_token; library_id := v_lib;
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.platform_revoke_library_owner_invite(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.library_owner_invitations SET status = 'revoked' WHERE id = p_id AND status = 'pending';
END $$;

CREATE OR REPLACE FUNCTION public.platform_list_library_owner_invites()
RETURNS TABLE(id uuid, email text, library_id uuid, library_name text, library_slug text, status text, token text, created_at timestamptz, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.email, i.library_id, l.name, l.subdomain, i.status, i.token, i.created_at, i.expires_at
  FROM public.library_owner_invitations i
  JOIN public.libraries l ON l.id = i.library_id
  WHERE public.is_platform_admin()
  ORDER BY i.created_at DESC;
$$;

-- Invite a new platform admin/super admin
CREATE OR REPLACE FUNCTION public.platform_invite_admin(p_email text, p_role text)
RETURNS TABLE(invitation_id uuid, token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_token text; v_id uuid;
BEGIN
  IF NOT public.is_platform_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_role NOT IN ('super_admin','platform_admin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  v_email := lower(trim(coalesce(p_email,'')));
  IF v_email = '' OR v_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN RAISE EXCEPTION 'Valid email required'; END IF;

  v_token := public._make_invite_token();
  INSERT INTO public.platform_admin_invitations (email, role, token, invited_by)
  VALUES (v_email, p_role, v_token, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', NULL, 'platform.invite_admin',
          jsonb_build_object('email', v_email, 'role', p_role));

  invitation_id := v_id; token := v_token;
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.platform_revoke_admin_invite(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.platform_admin_invitations SET status = 'revoked' WHERE id = p_id AND status = 'pending';
END $$;

CREATE OR REPLACE FUNCTION public.platform_list_admin_invites()
RETURNS TABLE(id uuid, email text, role text, status text, token text, created_at timestamptz, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, email, role, status, token, created_at, expires_at
  FROM public.platform_admin_invitations
  WHERE public.is_platform_admin()
  ORDER BY created_at DESC;
$$;

-- Lookup for accept page (unauth-safe: returns row only if token valid)
CREATE OR REPLACE FUNCTION public.get_owner_invitation_by_token(p_token text)
RETURNS TABLE(email text, library_name text, library_slug text, status text, expired boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.email, l.name, l.subdomain, i.status, (i.expires_at < now())
  FROM public.library_owner_invitations i
  JOIN public.libraries l ON l.id = i.library_id
  WHERE i.token = p_token LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_platform_invitation_by_token(p_token text)
RETURNS TABLE(email text, role text, status text, expired boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email, role, status, (expires_at < now())
  FROM public.platform_admin_invitations
  WHERE token = p_token LIMIT 1;
$$;

-- Extend handle_new_user to honor owner/platform tokens
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token text; v_owner RECORD; v_plat RECORD; v_staff RECORD;
BEGIN
  -- Library owner invitation
  v_token := NEW.raw_user_meta_data->>'owner_invitation_token';
  IF v_token IS NOT NULL AND v_token <> '' THEN
    SELECT * INTO v_owner FROM public.library_owner_invitations
      WHERE token = v_token AND status = 'pending' AND expires_at > now() LIMIT 1;
    IF v_owner.id IS NOT NULL THEN
      INSERT INTO public.staff_users (id, library_id, email, full_name, role, status)
      VALUES (NEW.id, v_owner.library_id, NEW.email,
              COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
              'owner', 'active');
      UPDATE public.libraries SET status = 'active' WHERE id = v_owner.library_id;
      UPDATE public.library_owner_invitations SET status = 'accepted' WHERE id = v_owner.id;
      RETURN NEW;
    END IF;
  END IF;

  -- Platform admin invitation
  v_token := NEW.raw_user_meta_data->>'platform_invitation_token';
  IF v_token IS NOT NULL AND v_token <> '' THEN
    SELECT * INTO v_plat FROM public.platform_admin_invitations
      WHERE token = v_token AND status = 'pending' AND expires_at > now() LIMIT 1;
    IF v_plat.id IS NOT NULL THEN
      INSERT INTO public.platform_admins (id, email, full_name, role)
      VALUES (NEW.id, NEW.email,
              COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
              v_plat.role)
      ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
      UPDATE public.platform_admin_invitations SET status = 'accepted' WHERE id = v_plat.id;
      RETURN NEW;
    END IF;
  END IF;

  -- Existing tenant staff invitation
  v_token := NEW.raw_user_meta_data->>'invitation_token';
  IF v_token IS NULL OR v_token = '' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_staff FROM public.invitations
    WHERE token = v_token AND status = 'pending' LIMIT 1;
  IF v_staff.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.staff_users (id, library_id, email, full_name, role, status)
  VALUES (NEW.id, v_staff.library_id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
          v_staff.role, 'active');
  UPDATE public.invitations SET status = 'accepted' WHERE id = v_staff.id;
  RETURN NEW;
END $$;
