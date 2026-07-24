
-- 1) Add subdomain column
ALTER TABLE public.libraries ADD COLUMN IF NOT EXISTS subdomain text;

-- 2) Backfill from name
DO $$
DECLARE r RECORD; base text; candidate text; n int;
BEGIN
  FOR r IN SELECT id, name FROM public.libraries WHERE subdomain IS NULL LOOP
    base := lower(regexp_replace(coalesce(r.name,''), '[^a-z0-9]+', '-', 'gi'));
    base := trim(both '-' from base);
    IF base IS NULL OR length(base) < 3 THEN
      base := 'lib-' || substring(replace(r.id::text,'-',''), 1, 6);
    END IF;
    IF length(base) > 30 THEN base := substring(base, 1, 30); END IF;
    base := trim(both '-' from base);
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM public.libraries WHERE subdomain = candidate) LOOP
      n := n + 1;
      candidate := substring(base, 1, 28) || '-' || n::text;
    END LOOP;
    UPDATE public.libraries SET subdomain = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- 3) Constraints
ALTER TABLE public.libraries ALTER COLUMN subdomain SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='libraries_subdomain_key') THEN
    ALTER TABLE public.libraries ADD CONSTRAINT libraries_subdomain_key UNIQUE (subdomain);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='libraries_subdomain_format') THEN
    ALTER TABLE public.libraries ADD CONSTRAINT libraries_subdomain_format
      CHECK (subdomain ~ '^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$');
  END IF;
END $$;

-- 4) Reserved-word check helper (in plpgsql via functions below)

-- 5) Update create_library_for_current_user to accept slug
DROP FUNCTION IF EXISTS public.create_library_for_current_user(text);
CREATE OR REPLACE FUNCTION public.create_library_for_current_user(p_name text, p_slug text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_user uuid; v_lib uuid; v_email text; v_name text; v_slug text;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'Library name is required'; END IF;
  IF EXISTS (SELECT 1 FROM public.staff_users WHERE id = v_user) THEN
    RAISE EXCEPTION 'You already belong to a library';
  END IF;

  v_slug := lower(trim(coalesce(p_slug,'')));
  IF length(v_slug) < 3 OR length(v_slug) > 30 THEN
    RAISE EXCEPTION 'Slug must be 3-30 characters';
  END IF;
  IF v_slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' THEN
    RAISE EXCEPTION 'Slug may only contain lowercase letters, numbers, and hyphens (no leading or trailing hyphen)';
  END IF;
  IF v_slug = ANY(ARRAY['www','app','api','admin','mail','static','assets','auth','login','signup','dashboard','support','onboarding','accept-invite']) THEN
    RAISE EXCEPTION 'That slug is reserved';
  END IF;
  IF EXISTS (SELECT 1 FROM public.libraries WHERE subdomain = v_slug) THEN
    RAISE EXCEPTION 'That slug is already taken';
  END IF;

  SELECT email, raw_user_meta_data->>'full_name' INTO v_email, v_name
    FROM auth.users WHERE id = v_user;

  INSERT INTO public.libraries (name, subdomain) VALUES (trim(p_name), v_slug) RETURNING id INTO v_lib;
  INSERT INTO public.staff_users (id, library_id, email, full_name, role, status)
    VALUES (v_user, v_lib, v_email, COALESCE(v_name, v_email), 'owner', 'active');
  RETURN v_lib;
END $function$;

GRANT EXECUTE ON FUNCTION public.create_library_for_current_user(text, text) TO authenticated;

-- 6) Public lookup by slug (for branded login)
CREATE OR REPLACE FUNCTION public.get_library_by_slug(p_slug text)
 RETURNS TABLE(id uuid, name text, subdomain text, logo_url text, brand_color text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT id, name, subdomain, logo_url, brand_color
  FROM public.libraries WHERE subdomain = lower(p_slug) LIMIT 1;
$function$;
GRANT EXECUTE ON FUNCTION public.get_library_by_slug(text) TO anon, authenticated;

-- 7) Owner-only slug update
CREATE OR REPLACE FUNCTION public.update_library_slug(p_slug text)
 RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_lib uuid; v_slug text;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Only owners can change the URL slug'; END IF;
  v_lib := public.get_user_library_id();
  IF v_lib IS NULL THEN RAISE EXCEPTION 'No library'; END IF;

  v_slug := lower(trim(coalesce(p_slug,'')));
  IF length(v_slug) < 3 OR length(v_slug) > 30 THEN RAISE EXCEPTION 'Slug must be 3-30 characters'; END IF;
  IF v_slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' THEN
    RAISE EXCEPTION 'Slug may only contain lowercase letters, numbers, and hyphens (no leading or trailing hyphen)';
  END IF;
  IF v_slug = ANY(ARRAY['www','app','api','admin','mail','static','assets','auth','login','signup','dashboard','support','onboarding','accept-invite']) THEN
    RAISE EXCEPTION 'That slug is reserved';
  END IF;
  IF EXISTS (SELECT 1 FROM public.libraries WHERE subdomain = v_slug AND id <> v_lib) THEN
    RAISE EXCEPTION 'That slug is already taken';
  END IF;

  UPDATE public.libraries SET subdomain = v_slug WHERE id = v_lib;
  RETURN v_slug;
END $function$;
GRANT EXECUTE ON FUNCTION public.update_library_slug(text) TO authenticated;

-- 8) Public read of library-logos so the branded login screen can show the logo before auth.
-- Bucket itself becomes public via the storage_update_bucket tool; this policy makes it explicit.
DROP POLICY IF EXISTS "library logos public read" ON storage.objects;
CREATE POLICY "library logos public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'library-logos');
