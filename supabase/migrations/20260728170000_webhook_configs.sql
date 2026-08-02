-- Book-scan webhook destination config (Integrations page + forward-scan-webhook edge fn).
-- The table may already exist in hosted projects; grants/RLS are what the UI needs.

CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  url text,
  auth_header text,
  is_active boolean NOT NULL DEFAULT false,
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.webhook_configs TO authenticated;
GRANT ALL ON public.webhook_configs TO service_role;

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_configs: platform admin read" ON public.webhook_configs;
DROP POLICY IF EXISTS "webhook_configs: platform admin insert" ON public.webhook_configs;
DROP POLICY IF EXISTS "webhook_configs: platform admin update" ON public.webhook_configs;

CREATE POLICY "webhook_configs: platform admin read"
  ON public.webhook_configs FOR SELECT TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "webhook_configs: platform admin insert"
  ON public.webhook_configs FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "webhook_configs: platform admin update"
  ON public.webhook_configs FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
