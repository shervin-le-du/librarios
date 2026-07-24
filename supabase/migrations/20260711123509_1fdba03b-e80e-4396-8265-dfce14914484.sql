
-- Storage policies for library-home-images bucket
CREATE POLICY "library home images public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'library-home-images');

CREATE POLICY "staff write own library home image" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'library-home-images'
    AND (storage.foldername(name))[1] = (public.get_user_library_id())::text
  );

CREATE POLICY "staff update own library home image" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'library-home-images'
    AND (storage.foldername(name))[1] = (public.get_user_library_id())::text
  );

CREATE POLICY "staff delete own library home image" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'library-home-images'
    AND (storage.foldername(name))[1] = (public.get_user_library_id())::text
  );
