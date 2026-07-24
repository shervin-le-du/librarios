CREATE OR REPLACE FUNCTION public.enforce_staff_role_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_actor_rank int;
  v_target_rank int;
  v_prev_rank int;
  v_platform_role text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT role INTO v_platform_role FROM public.platform_admins WHERE id = v_actor;
  IF v_platform_role IN ('owner','super_admin','admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT role INTO v_actor_role FROM public.staff_users
    WHERE id = v_actor
      AND library_id = COALESCE(NEW.library_id, OLD.library_id)
      AND status = 'active'
    LIMIT 1;

  IF v_actor_role IS NULL THEN
    IF public.is_platform_admin() AND
       COALESCE(NEW.library_id, OLD.library_id) = public.active_support_library_id() THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
    RAISE EXCEPTION 'Not authorized to modify staff';
  END IF;

  v_actor_rank := public.staff_role_rank(v_actor_role);

  IF TG_OP = 'INSERT' THEN
    v_target_rank := public.staff_role_rank(NEW.role);
    IF v_target_rank >= v_actor_rank THEN
      RAISE EXCEPTION 'You cannot assign a role at or above your own';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_prev_rank := public.staff_role_rank(OLD.role);
    v_target_rank := public.staff_role_rank(NEW.role);
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      IF v_prev_rank >= v_actor_rank THEN
        RAISE EXCEPTION 'You cannot change the role of someone at or above your rank';
      END IF;
      IF v_target_rank >= v_actor_rank THEN
        RAISE EXCEPTION 'You cannot promote someone to a role at or above your own';
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_prev_rank := public.staff_role_rank(OLD.role);
    IF v_prev_rank >= v_actor_rank THEN
      RAISE EXCEPTION 'You cannot remove someone at or above your rank';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;