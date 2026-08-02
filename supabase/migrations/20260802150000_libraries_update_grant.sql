-- libraries had SELECT-only grants for authenticated users, so UPDATE operations
-- (branding, logo_url, home_page_config, etc.) failed with
-- "permission denied for table libraries" despite RLS policies.
GRANT UPDATE ON public.libraries TO authenticated;
