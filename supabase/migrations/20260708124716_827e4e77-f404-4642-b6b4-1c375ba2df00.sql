
-- List every auth user with their effective platform role and library memberships.
-- Owner + super_admin only.
CREATE OR REPLACE FUNCTION public.platform_list_all_users()
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  platform_role text,
  library_memberships jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    u.id,
    u.email::text,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email)::text AS full_name,
    u.created_at,
    u.last_sign_in_at,
    pa.role::text AS platform_role,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'library_id', s.library_id,
        'library_name', l.name,
        'library_slug', l.subdomain,
        'role', s.role,
        'status', s.status
      ) ORDER BY l.name)
      FROM public.staff_users s
      JOIN public.libraries l ON l.id = s.library_id
      WHERE s.id = u.id
    ), '[]'::jsonb) AS library_memberships
  FROM auth.users u
  LEFT JOIN public.platform_admins pa ON pa.id = u.id
  WHERE EXISTS (
    SELECT 1 FROM public.platform_admins me
    WHERE me.id = auth.uid() AND me.role IN ('owner','super_admin')
  )
  ORDER BY u.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_all_users() TO authenticated;

-- Delete an auth account entirely (cascades to staff_users, platform_admins, readers, etc.)
-- Rules:
--   owner       -> can delete anyone except themselves and any other owner
--   super_admin -> can delete admins and users with no platform role, but NOT owners or other super_admins
--   admin       -> cannot delete anyone
CREATE OR REPLACE FUNCTION public.platform_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_target_role text;
  v_target_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot delete your own account'; END IF;

  SELECT role INTO v_caller_role FROM public.platform_admins WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner','super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT email INTO v_target_email FROM auth.users WHERE id = p_user_id;
  IF v_target_email IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  SELECT role INTO v_target_role FROM public.platform_admins WHERE id = p_user_id;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'The platform owner cannot be deleted';
  END IF;
  IF v_target_role = 'super_admin' AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can delete a super admin';
  END IF;

  -- Clean dependents that don't cascade automatically
  DELETE FROM public.platform_admins WHERE id = p_user_id;
  DELETE FROM public.staff_users WHERE id = p_user_id;
  UPDATE public.readers SET auth_user_id = NULL WHERE auth_user_id = p_user_id;

  DELETE FROM auth.users WHERE id = p_user_id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', NULL, 'platform.delete_user',
          jsonb_build_object('target', p_user_id, 'email', v_target_email, 'was_role', v_target_role));
END $$;

GRANT EXECUTE ON FUNCTION public.platform_delete_user(uuid) TO authenticated;
