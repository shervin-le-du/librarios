
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Storage policies for book-covers: authenticated staff can manage; anyone signed-in can read.
CREATE POLICY "book-covers read authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'book-covers');

CREATE POLICY "book-covers read anon"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'book-covers');

CREATE POLICY "book-covers insert authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'book-covers');

CREATE POLICY "book-covers update authenticated"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'book-covers');

CREATE POLICY "book-covers delete authenticated"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'book-covers');
