
CREATE TABLE public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  isbn_webhook_url text,
  isbn_webhook_auth_header text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
-- No policies: all access goes through SECURITY DEFINER RPCs below.

INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_isbn_webhook_config()
RETURNS TABLE(url text, has_auth boolean, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.isbn_webhook_url,
         (s.isbn_webhook_auth_header IS NOT NULL AND length(s.isbn_webhook_auth_header) > 0),
         s.updated_at
  FROM public.platform_settings s
  WHERE public.is_platform_admin()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_isbn_webhook_config(p_url text, p_auth_header text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_url text; v_auth text;
BEGIN
  IF NOT public.is_platform_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  v_url := NULLIF(trim(coalesce(p_url, '')), '');
  IF v_url IS NOT NULL AND v_url !~* '^https://' THEN
    RAISE EXCEPTION 'Webhook URL must use https://';
  END IF;
  v_auth := NULLIF(trim(coalesce(p_auth_header, '')), '');
  UPDATE public.platform_settings
    SET isbn_webhook_url = v_url,
        isbn_webhook_auth_header = v_auth,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = true;
  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', NULL, 'platform.isbn_webhook.set',
          jsonb_build_object('configured', v_url IS NOT NULL, 'has_auth', v_auth IS NOT NULL));
END $$;

CREATE OR REPLACE FUNCTION public.clear_isbn_webhook_config()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.platform_settings
    SET isbn_webhook_url = NULL,
        isbn_webhook_auth_header = NULL,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = true;
  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', NULL, 'platform.isbn_webhook.clear', '{}'::jsonb);
END $$;
