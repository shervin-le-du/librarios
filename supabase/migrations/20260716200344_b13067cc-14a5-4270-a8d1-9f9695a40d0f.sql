
DROP FUNCTION public.get_library_public_home(text);

CREATE FUNCTION public.get_library_public_home(p_slug text)
RETURNS TABLE(
  id uuid, name text, subdomain text, logo_url text, brand_color text,
  languages text[], contact_email text, contact_phone text, contact_address text,
  home_page_config jsonb, status text, patron_portal_enabled boolean, visibility text,
  published_at timestamp with time zone, published_snapshot jsonb, branding jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id, name, subdomain, logo_url, brand_color, languages,
         contact_email, contact_phone, contact_address, home_page_config, status,
         patron_portal_enabled, visibility, published_at, published_snapshot, branding
  FROM public.libraries WHERE subdomain = lower(p_slug) LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_library_public_home(text) TO anon, authenticated;
