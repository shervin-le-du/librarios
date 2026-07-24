
ALTER TABLE public.libraries
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','private')),
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_snapshot jsonb;

DROP FUNCTION IF EXISTS public.get_library_public_home(text);

CREATE OR REPLACE FUNCTION public.get_library_public_home(p_slug text)
 RETURNS TABLE(id uuid, name text, subdomain text, logo_url text, brand_color text, languages text[], contact_email text, contact_phone text, contact_address text, home_page_config jsonb, status text, patron_portal_enabled boolean, visibility text, published_at timestamptz, published_snapshot jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT id, name, subdomain, logo_url, brand_color, languages,
         contact_email, contact_phone, contact_address, home_page_config, status,
         patron_portal_enabled, visibility, published_at, published_snapshot
  FROM public.libraries WHERE subdomain = lower(p_slug) LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.publish_library(p_library_id uuid)
 RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role text; v_now timestamptz := now(); v_snapshot jsonb;
BEGIN
  SELECT role::text INTO v_role FROM public.staff_users
  WHERE library_id = p_library_id AND user_id = auth.uid() AND status = 'active' LIMIT 1;
  IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT jsonb_build_object(
    'name', name, 'logo_url', logo_url, 'brand_color', brand_color,
    'languages', languages, 'contact_email', contact_email, 'contact_phone', contact_phone,
    'contact_address', contact_address, 'home_page_config', home_page_config,
    'patron_portal_enabled', patron_portal_enabled
  ) INTO v_snapshot FROM public.libraries WHERE id = p_library_id;
  UPDATE public.libraries
  SET published_snapshot = v_snapshot, published_at = v_now,
      home_page_config = jsonb_set(coalesce(home_page_config, '{}'::jsonb), '{published}', 'true'::jsonb)
  WHERE id = p_library_id;
  RETURN v_now;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_library_visibility(p_library_id uuid, p_visibility text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role text;
BEGIN
  IF p_visibility NOT IN ('public','private') THEN RAISE EXCEPTION 'Invalid visibility'; END IF;
  SELECT role::text INTO v_role FROM public.staff_users
  WHERE library_id = p_library_id AND user_id = auth.uid() AND status = 'active' LIMIT 1;
  IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.libraries SET visibility = p_visibility WHERE id = p_library_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.publish_library(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_library_visibility(uuid, text) TO authenticated;
