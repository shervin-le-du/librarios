
DROP FUNCTION public.get_library_by_slug(text);

CREATE FUNCTION public.get_library_by_slug(p_slug text)
RETURNS TABLE(id uuid, name text, subdomain text, logo_url text, brand_color text, branding jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT id, name, subdomain, logo_url, brand_color, branding
  FROM public.libraries WHERE subdomain = lower(p_slug) LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_library_by_slug(text) TO anon, authenticated;
