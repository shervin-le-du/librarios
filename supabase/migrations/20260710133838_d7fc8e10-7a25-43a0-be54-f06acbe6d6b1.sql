
CREATE TABLE public.book_scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  extracted_data jsonb,
  error_message text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX book_scan_jobs_library_idx ON public.book_scan_jobs(library_id, created_at DESC);
CREATE INDEX book_scan_jobs_status_idx ON public.book_scan_jobs(status) WHERE status IN ('pending','processing');

GRANT SELECT, INSERT ON public.book_scan_jobs TO authenticated;
GRANT ALL ON public.book_scan_jobs TO service_role;

ALTER TABLE public.book_scan_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_jobs: staff read"
  ON public.book_scan_jobs FOR SELECT TO authenticated
  USING (public.in_tenant_scope(library_id));

CREATE POLICY "scan_jobs: staff insert"
  ON public.book_scan_jobs FOR INSERT TO authenticated
  WITH CHECK (public.in_tenant_scope(library_id) AND created_by = auth.uid());

CREATE OR REPLACE FUNCTION public._book_scan_jobs_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER book_scan_jobs_touch
  BEFORE UPDATE ON public.book_scan_jobs
  FOR EACH ROW EXECUTE FUNCTION public._book_scan_jobs_touch();

ALTER PUBLICATION supabase_realtime ADD TABLE public.book_scan_jobs;

CREATE POLICY "scan-staging: staff upload to own library"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'scan-staging'
    AND public.in_tenant_scope((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "scan-staging: staff read own library"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'scan-staging'
    AND public.in_tenant_scope((storage.foldername(name))[1]::uuid)
  );
