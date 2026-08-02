-- Storage buckets referenced by RLS policies were previously created manually via
-- dashboard/Lovable tooling and are missing on fresh Supabase projects.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('library-logos', 'library-logos', true),
  ('library-branding', 'library-branding', false),
  ('library-home-images', 'library-home-images', true),
  ('user-avatars', 'user-avatars', false),
  ('book-covers', 'book-covers', true),
  ('scan-staging', 'scan-staging', false)
ON CONFLICT (id) DO NOTHING;
