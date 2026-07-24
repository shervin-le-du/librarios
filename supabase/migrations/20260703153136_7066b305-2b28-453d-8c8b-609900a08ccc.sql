
-- 1) Extend check constraints to accept the new role tiers
ALTER TABLE public.platform_admins DROP CONSTRAINT platform_admins_role_check;
ALTER TABLE public.platform_admins ADD CONSTRAINT platform_admins_role_check
  CHECK (role = ANY (ARRAY['owner','super_admin','admin']));

ALTER TABLE public.platform_admin_invitations DROP CONSTRAINT platform_admin_invitations_role_check;
ALTER TABLE public.platform_admin_invitations ADD CONSTRAINT platform_admin_invitations_role_check
  CHECK (role = ANY (ARRAY['super_admin','admin']));

-- 2) Rename existing 'platform_admin' rows to 'admin'
UPDATE public.platform_admins SET role = 'admin' WHERE role = 'platform_admin';
UPDATE public.platform_admin_invitations SET role = 'admin' WHERE role = 'platform_admin';

-- 3) Pin the owner (shervinledu@gmail.com) if the auth user exists
DO $$
DECLARE v_uid uuid; v_email text; v_name text;
BEGIN
  SELECT id, email, raw_user_meta_data->>'full_name'
    INTO v_uid, v_email, v_name
    FROM auth.users WHERE lower(email) = 'shervinledu@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.platform_admins (id, email, full_name, role)
    VALUES (v_uid, lower(v_email), v_name, 'owner')
    ON CONFLICT (id) DO UPDATE SET role = 'owner';
  END IF;
END $$;

-- 4) Replace the "must have a super_admin" trigger with an "must have the owner" trigger
DROP TRIGGER IF EXISTS trg_super_admin_floor ON public.platform_admins;
DROP FUNCTION IF EXISTS public.enforce_super_admin_floor();

CREATE OR REPLACE FUNCTION public.enforce_owner_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
    RAISE EXCEPTION 'The platform owner cannot be removed';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner' THEN
    RAISE EXCEPTION 'The platform owner role cannot be changed';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_owner_immutable
BEFORE UPDATE OR DELETE ON public.platform_admins
FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_immutable();

-- 5) Owner helper. Keep is_platform_super_admin() truthy for both owner + super_admin
--    so existing gates (support session start, ISBN webhook, etc.) keep working.
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid() AND role = 'owner');
$$;

CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE id = auth.uid() AND role IN ('owner','super_admin')
  );
$$;

-- 6) Grant/revoke RPCs with tiered permissions
CREATE OR REPLACE FUNCTION public.platform_grant_role(p_email text, p_role text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user uuid; v_name text; v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM public.platform_admins WHERE id = auth.uid();
  IF v_caller_role IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_role NOT IN ('super_admin','admin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF p_role = 'super_admin' AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can grant super admin';
  END IF;
  IF p_role = 'admin' AND v_caller_role NOT IN ('owner','super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id, raw_user_meta_data->>'full_name' INTO v_user, v_name
    FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'No user with that email — they must sign up first'; END IF;

  INSERT INTO public.platform_admins (id, email, full_name, role)
  VALUES (v_user, lower(trim(p_email)), v_name, p_role)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role
    WHERE public.platform_admins.role <> 'owner';

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', NULL, 'platform.grant_role',
          jsonb_build_object('target', v_user, 'role', p_role));
  RETURN v_user;
END $$;

CREATE OR REPLACE FUNCTION public.platform_revoke_role(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_target_role text; v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM public.platform_admins WHERE id = auth.uid();
  IF v_caller_role IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT role INTO v_target_role FROM public.platform_admins WHERE id = p_user_id;
  IF v_target_role IS NULL THEN RETURN; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'The platform owner cannot be revoked'; END IF;
  IF v_target_role = 'super_admin' AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can revoke a super admin';
  END IF;
  IF v_target_role = 'admin' AND v_caller_role NOT IN ('owner','super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.platform_admins WHERE id = p_user_id;
  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', NULL, 'platform.revoke_role',
          jsonb_build_object('target', p_user_id, 'was', v_target_role));
END $$;

-- 7) Invite RPCs with the same tiered permissions
CREATE OR REPLACE FUNCTION public.platform_invite_admin(p_email text, p_role text)
RETURNS TABLE(invitation_id uuid, token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email text; v_token text; v_id uuid; v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM public.platform_admins WHERE id = auth.uid();
  IF v_caller_role IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_role NOT IN ('super_admin','admin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF p_role = 'super_admin' AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can invite a super admin';
  END IF;
  IF p_role = 'admin' AND v_caller_role NOT IN ('owner','super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM public.platform_admins WHERE id = auth.uid();
  IF v_caller_role NOT IN ('owner','super_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.platform_admin_invitations SET status = 'revoked'
    WHERE id = p_id AND status = 'pending';
END $$;

-- 8) handle_new_user: auto-promote the pinned owner email; and adapt platform invite branch
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token text; v_owner RECORD; v_plat RECORD; v_staff RECORD;
BEGIN
  -- Pinned platform owner
  IF lower(NEW.email) = 'shervinledu@gmail.com' THEN
    INSERT INTO public.platform_admins (id, email, full_name, role)
    VALUES (NEW.id, lower(NEW.email),
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            'owner')
    ON CONFLICT (id) DO UPDATE SET role = 'owner';
    RETURN NEW;
  END IF;

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
      ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role
        WHERE public.platform_admins.role <> 'owner';
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
END $function$;
