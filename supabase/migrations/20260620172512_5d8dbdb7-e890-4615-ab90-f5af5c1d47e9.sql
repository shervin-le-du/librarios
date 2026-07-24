-- Add role tier to platform_admins
ALTER TABLE public.platform_admins
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'super_admin'
  CHECK (role IN ('super_admin','platform_admin'));

-- Ensure at least one super_admin exists
CREATE OR REPLACE FUNCTION public.enforce_super_admin_floor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.platform_admins WHERE role = 'super_admin';
  IF n = 0 THEN
    RAISE EXCEPTION 'At least one super_admin must exist';
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_super_admin_floor ON public.platform_admins;
CREATE CONSTRAINT TRIGGER trg_super_admin_floor
  AFTER UPDATE OR DELETE ON public.platform_admins
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_super_admin_floor();

-- Helpers
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid() AND role = 'super_admin');
$$;

-- is_platform_admin already returns true for any row; keep behavior (covers both roles).

-- Tighten suspend/reactivate to super_admin only
CREATE OR REPLACE FUNCTION public.platform_set_library_status(p_library_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.libraries SET status = p_status WHERE id = p_library_id;
  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', p_library_id,
          CASE WHEN p_status = 'suspended' THEN 'library.suspend' ELSE 'library.reactivate' END,
          jsonb_build_object('status', p_status));
END $$;

-- Grant / revoke platform roles (super_admin only)
CREATE OR REPLACE FUNCTION public.platform_grant_role(p_email text, p_role text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_name text;
BEGIN
  IF NOT public.is_platform_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_role NOT IN ('super_admin','platform_admin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  SELECT id, raw_user_meta_data->>'full_name' INTO v_user, v_name
    FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'No user with that email — they must sign up first'; END IF;

  INSERT INTO public.platform_admins (id, email, full_name, role)
  VALUES (v_user, lower(trim(p_email)), v_name, p_role)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', NULL, 'platform.grant_role',
          jsonb_build_object('target', v_user, 'role', p_role));
  RETURN v_user;
END $$;

CREATE OR REPLACE FUNCTION public.platform_revoke_role(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.platform_admins WHERE id = p_user_id;
  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', NULL, 'platform.revoke_role',
          jsonb_build_object('target', p_user_id));
END $$;

CREATE OR REPLACE FUNCTION public.platform_list_admins()
RETURNS TABLE(id uuid, email text, full_name text, role text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, email, full_name, role, created_at FROM public.platform_admins
  WHERE public.is_platform_admin()
  ORDER BY role, created_at;
$$;