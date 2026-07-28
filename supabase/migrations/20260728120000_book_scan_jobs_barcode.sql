-- Barcode/ISBN scanning as the primary capture path; photo capture is now a fallback.
ALTER TABLE public.book_scan_jobs
  ADD COLUMN IF NOT EXISTS scan_method text NOT NULL DEFAULT 'photo';

ALTER TABLE public.book_scan_jobs
  ADD COLUMN IF NOT EXISTS isbn text;

-- Barcode jobs have no uploaded image.
ALTER TABLE public.book_scan_jobs
  ALTER COLUMN storage_path DROP NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.book_scan_jobs
    ADD CONSTRAINT book_scan_jobs_scan_method_check
    CHECK (scan_method IN ('photo', 'barcode'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
