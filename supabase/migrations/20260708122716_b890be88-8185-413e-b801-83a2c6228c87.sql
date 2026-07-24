
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

ALTER TABLE public.library_owner_invitations
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

ALTER TABLE public.platform_admin_invitations
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

DROP FUNCTION IF EXISTS public.get_invitation_by_token(text);
DROP FUNCTION IF EXISTS public.get_owner_invitation_by_token(text);
DROP FUNCTION IF EXISTS public.get_platform_invitation_by_token(text);

CREATE FUNCTION public.get_invitation_by_token(p_token text)
 RETURNS TABLE(email text, role text, library_name text, status text, first_name text, last_name text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT i.email, i.role, l.name, i.status, i.first_name, i.last_name
  FROM public.invitations i JOIN public.libraries l ON l.id = i.library_id
  WHERE i.token = p_token LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

CREATE FUNCTION public.get_owner_invitation_by_token(p_token text)
 RETURNS TABLE(email text, library_name text, library_slug text, status text, expired boolean, first_name text, last_name text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT i.email, l.name, l.subdomain, i.status, (i.expires_at < now()), i.first_name, i.last_name
  FROM public.library_owner_invitations i JOIN public.libraries l ON l.id = i.library_id
  WHERE i.token = p_token LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_owner_invitation_by_token(text) TO anon, authenticated;

CREATE FUNCTION public.get_platform_invitation_by_token(p_token text)
 RETURNS TABLE(email text, role text, status text, expired boolean, first_name text, last_name text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT email, role, status, (expires_at < now()), first_name, last_name
  FROM public.platform_admin_invitations WHERE token = p_token LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_platform_invitation_by_token(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.platform_invite_library_owner(text, text, text);
CREATE FUNCTION public.platform_invite_library_owner(
  p_name text, p_slug text, p_email text, p_first_name text DEFAULT NULL, p_last_name text DEFAULT NULL
)
 RETURNS TABLE(invitation_id uuid, token text, library_id uuid)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

  INSERT INTO public.libraries (name, subdomain, status) VALUES (trim(p_name), v_slug, 'pending_setup') RETURNING id INTO v_lib;
  v_token := public._make_invite_token();
  INSERT INTO public.library_owner_invitations (library_id, email, token, invited_by, first_name, last_name)
  VALUES (v_lib, v_email, v_token, auth.uid(),
          NULLIF(trim(coalesce(p_first_name,'')),''),
          NULLIF(trim(coalesce(p_last_name,'')),''))
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', v_lib, 'platform.invite_library_owner',
          jsonb_build_object('email', v_email, 'slug', v_slug));

  invitation_id := v_id; token := v_token; library_id := v_lib;
  RETURN NEXT;
END $$;

DROP FUNCTION IF EXISTS public.platform_invite_admin(text, text);
CREATE FUNCTION public.platform_invite_admin(
  p_email text, p_role text, p_first_name text DEFAULT NULL, p_last_name text DEFAULT NULL
)
 RETURNS TABLE(invitation_id uuid, token text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  INSERT INTO public.platform_admin_invitations (email, role, token, invited_by, first_name, last_name)
  VALUES (v_email, p_role, v_token, auth.uid(),
          NULLIF(trim(coalesce(p_first_name,'')),''),
          NULLIF(trim(coalesce(p_last_name,'')),''))
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', NULL, 'platform.invite_admin',
          jsonb_build_object('email', v_email, 'role', p_role));

  invitation_id := v_id; token := v_token;
  RETURN NEXT;
END $$;
