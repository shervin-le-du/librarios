
ALTER TABLE public.invitations DROP CONSTRAINT invitations_invited_by_fkey;

ALTER TABLE public.staff_users DROP CONSTRAINT staff_users_pkey;
ALTER TABLE public.staff_users ADD PRIMARY KEY (id, library_id);

CREATE OR REPLACE FUNCTION public.in_tenant_scope(_library_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _library_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE id = auth.uid() AND library_id = _library_id AND status = 'active'
    )
    OR _library_id = public.active_support_library_id()
  );
$$;

DROP FUNCTION IF EXISTS public.get_current_staff();
CREATE OR REPLACE FUNCTION public.get_current_staff()
RETURNS TABLE(
  id uuid,
  library_id uuid,
  email text,
  full_name text,
  role text,
  status text,
  library_status text,
  library_name text,
  library_slug text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.library_id, s.email, s.full_name, s.role, s.status,
         l.status, l.name, l.subdomain
  FROM public.staff_users s
  LEFT JOIN public.libraries l ON l.id = s.library_id
  WHERE s.id = auth.uid()
  ORDER BY l.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_staff() TO authenticated;
