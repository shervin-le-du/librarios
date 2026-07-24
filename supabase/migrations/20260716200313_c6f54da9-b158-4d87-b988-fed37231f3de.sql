
CREATE POLICY "library-branding read"
ON storage.objects FOR SELECT
USING (bucket_id = 'library-branding');

CREATE POLICY "library-branding write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'library-branding'
  AND EXISTS (
    SELECT 1 FROM public.staff_users su
    WHERE su.id = auth.uid()
      AND su.library_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "library-branding update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'library-branding'
  AND EXISTS (
    SELECT 1 FROM public.staff_users su
    WHERE su.id = auth.uid()
      AND su.library_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "library-branding delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'library-branding'
  AND EXISTS (
    SELECT 1 FROM public.staff_users su
    WHERE su.id = auth.uid()
      AND su.library_id::text = (storage.foldername(name))[1]
  )
);
