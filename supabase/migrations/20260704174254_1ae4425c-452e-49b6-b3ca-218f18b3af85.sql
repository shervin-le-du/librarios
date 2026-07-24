
CREATE TABLE public.platform_email_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  accent_color text NOT NULL DEFAULT '#2563eb',
  logo_url text,
  footer_text text NOT NULL DEFAULT 'You received this email because you were invited to a library on our platform.',
  site_name text NOT NULL DEFAULT 'Librarios',
  invite_expiry_hours integer NOT NULL DEFAULT 336,
  template_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.platform_email_settings TO authenticated;
GRANT ALL ON public.platform_email_settings TO service_role;

ALTER TABLE public.platform_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read platform email settings"
  ON public.platform_email_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins can insert platform email settings"
  ON public.platform_email_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());
CREATE POLICY "Platform admins can update platform email settings"
  ON public.platform_email_settings FOR UPDATE TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

INSERT INTO public.platform_email_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.libraries
  ADD COLUMN IF NOT EXISTS email_accent_color text,
  ADD COLUMN IF NOT EXISTS email_logo_url text,
  ADD COLUMN IF NOT EXISTS email_footer_text text,
  ADD COLUMN IF NOT EXISTS email_template_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.get_effective_email_settings(p_library_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_platform RECORD;
  v_lib RECORD;
  v_result jsonb;
BEGIN
  SELECT * INTO v_platform FROM public.platform_email_settings WHERE id = true;
  v_result := jsonb_build_object(
    'accent_color', v_platform.accent_color,
    'logo_url', v_platform.logo_url,
    'footer_text', v_platform.footer_text,
    'site_name', v_platform.site_name,
    'invite_expiry_hours', v_platform.invite_expiry_hours,
    'template_overrides', v_platform.template_overrides
  );

  IF p_library_id IS NOT NULL THEN
    SELECT id, name, subdomain, brand_color, logo_url,
           email_accent_color, email_logo_url, email_footer_text, email_template_overrides
      INTO v_lib
      FROM public.libraries WHERE id = p_library_id;
    IF v_lib.id IS NOT NULL THEN
      v_result := v_result || jsonb_build_object(
        'library_id', v_lib.id,
        'library_name', v_lib.name,
        'library_slug', v_lib.subdomain,
        'accent_color', COALESCE(v_lib.email_accent_color, v_lib.brand_color, v_platform.accent_color),
        'logo_url', COALESCE(v_lib.email_logo_url, v_lib.logo_url, v_platform.logo_url),
        'footer_text', COALESCE(v_lib.email_footer_text, v_platform.footer_text),
        'library_template_overrides', COALESCE(v_lib.email_template_overrides, '{}'::jsonb)
      );
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.patch_platform_email_settings(p_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.platform_email_settings SET
    accent_color = COALESCE(p_patch->>'accent_color', accent_color),
    logo_url = CASE WHEN p_patch ? 'logo_url' THEN NULLIF(p_patch->>'logo_url','') ELSE logo_url END,
    footer_text = COALESCE(p_patch->>'footer_text', footer_text),
    site_name = COALESCE(p_patch->>'site_name', site_name),
    invite_expiry_hours = COALESCE((p_patch->>'invite_expiry_hours')::int, invite_expiry_hours),
    template_overrides = COALESCE(p_patch->'template_overrides', template_overrides),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.patch_library_email_settings(p_library_id uuid, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT role::text INTO v_role FROM public.staff_users
    WHERE library_id = p_library_id AND user_id = auth.uid() AND status = 'active' LIMIT 1;
  IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN
    IF NOT (p_library_id = public.active_support_library_id() AND public.is_platform_admin()) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  END IF;
  UPDATE public.libraries SET
    email_accent_color = CASE WHEN p_patch ? 'accent_color' THEN NULLIF(p_patch->>'accent_color','') ELSE email_accent_color END,
    email_logo_url = CASE WHEN p_patch ? 'logo_url' THEN NULLIF(p_patch->>'logo_url','') ELSE email_logo_url END,
    email_footer_text = CASE WHEN p_patch ? 'footer_text' THEN NULLIF(p_patch->>'footer_text','') ELSE email_footer_text END,
    email_template_overrides = COALESCE(p_patch->'template_overrides', email_template_overrides)
  WHERE id = p_library_id;
END;
$$;
