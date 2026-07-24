
ALTER TABLE public.libraries
  ADD COLUMN IF NOT EXISTS home_page_config jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.get_library_public_home(p_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  subdomain text,
  logo_url text,
  brand_color text,
  languages text[],
  contact_email text,
  contact_phone text,
  contact_address text,
  home_page_config jsonb,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, subdomain, logo_url, brand_color, languages,
         contact_email, contact_phone, contact_address, home_page_config, status
  FROM public.libraries
  WHERE subdomain = lower(p_slug)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_library_public_home(text) TO anon, authenticated;
