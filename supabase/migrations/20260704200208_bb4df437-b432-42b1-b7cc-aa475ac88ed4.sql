
ALTER TABLE public.libraries DROP CONSTRAINT IF EXISTS libraries_status_check;
ALTER TABLE public.libraries ADD CONSTRAINT libraries_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text, 'pending_setup'::text]));

CREATE OR REPLACE FUNCTION public.platform_invite_library_owner(p_name text, p_slug text, p_email text)
RETURNS TABLE(invitation_id uuid, token text, library_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  INSERT INTO public.library_owner_invitations (library_id, email, token, invited_by)
  VALUES (v_lib, v_email, v_token, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', v_lib, 'platform.invite_library_owner',
          jsonb_build_object('email', v_email, 'slug', v_slug));

  invitation_id := v_id; token := v_token; library_id := v_lib;
  RETURN NEXT;
END $function$;

-- Backfill: libraries with a still-pending owner invite and no staff yet should reflect the new status.
UPDATE public.libraries l
   SET status = 'pending_setup'
  FROM public.library_owner_invitations i
 WHERE i.library_id = l.id
   AND i.status = 'pending'
   AND l.status = 'suspended'
   AND NOT EXISTS (SELECT 1 FROM public.staff_users s WHERE s.library_id = l.id);
