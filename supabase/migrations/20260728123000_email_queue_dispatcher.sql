-- Email queue dispatcher
--
-- 20260704141500_email_infra.sql created the queues, the send log, and the
-- worker route, but left the pg_cron job that drains the queues to be applied
-- out of band. When that job is missing (or points at a dead URL) enqueued mail
-- sits in pgmq until it hits its TTL and lands in the DLQ, with the only
-- successful sends being manual POSTs to /lovable/email/queue/process.
--
-- This migration owns the dispatcher instead: the target URL lives in
-- email_send_state so it can be changed with an UPDATE, and the service role key
-- is read from vault at execution time so no secret enters version control.
--
-- Prerequisite (one-off, contains a secret so it is NOT in this file):
--   SELECT vault.create_secret('<service_role_key>', 'email_queue_service_role_key');
--
-- To revert: SELECT cron.unschedule('process-email-queue');

DO $$ BEGIN
  ALTER TABLE public.email_send_state
    ADD COLUMN worker_url TEXT NOT NULL DEFAULT 'https://librarios.com/lovable/email/queue/process';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Posts to the worker route when there is anything to send. Kept as a function
-- rather than an inline cron command so it can be run by hand to test, and so
-- pg_net's schema is resolved at runtime (it differs between Supabase projects).
CREATE OR REPLACE FUNCTION public.dispatch_email_queue()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
  v_net_schema TEXT;
  v_queue TEXT;
  v_relation regclass;
  v_count BIGINT;
  v_pending BIGINT := 0;
BEGIN
  SELECT worker_url INTO v_url FROM public.email_send_state WHERE id = 1;
  IF v_url IS NULL OR length(trim(v_url)) = 0 THEN
    RETURN 'skipped: worker_url not configured';
  END IF;

  -- Respect the Retry-After cooldown the worker records after a 429.
  IF EXISTS (
    SELECT 1 FROM public.email_send_state
    WHERE id = 1 AND retry_after_until IS NOT NULL AND retry_after_until > now()
  ) THEN
    RETURN 'skipped: rate limited';
  END IF;

  FOREACH v_queue IN ARRAY ARRAY['auth_emails', 'transactional_emails'] LOOP
    v_relation := to_regclass('pgmq.q_' || v_queue);
    IF v_relation IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %s', v_relation) INTO v_count;
      v_pending := v_pending + coalesce(v_count, 0);
    END IF;
  END LOOP;

  IF v_pending = 0 THEN
    RETURN 'skipped: queues empty';
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key';

  IF v_key IS NULL THEN
    RETURN 'skipped: vault secret email_queue_service_role_key is missing';
  END IF;

  SELECT n.nspname INTO v_net_schema
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'http_post'
  ORDER BY (n.nspname = 'net') DESC
  LIMIT 1;

  IF v_net_schema IS NULL THEN
    RETURN 'skipped: pg_net is not installed';
  END IF;

  EXECUTE format(
    'SELECT %I.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := $4)',
    v_net_schema
  )
  USING
    v_url,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    25000;

  RETURN format('dispatched: %s queued', v_pending);
END $$;

-- The function reads a service role key and posts to an arbitrary URL, so it
-- must never be reachable through PostgREST.
REVOKE ALL ON FUNCTION public.dispatch_email_queue() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_email_queue() FROM anon, authenticated;

DO $$ BEGIN
  PERFORM cron.unschedule('process-email-queue');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Sub-minute schedules need pg_cron >= 1.5; fall back to once a minute.
DO $$ BEGIN
  PERFORM cron.schedule('process-email-queue', '5 seconds', 'SELECT public.dispatch_email_queue();');
EXCEPTION WHEN OTHERS THEN
  PERFORM cron.schedule('process-email-queue', '* * * * *', 'SELECT public.dispatch_email_queue();');
END $$;
