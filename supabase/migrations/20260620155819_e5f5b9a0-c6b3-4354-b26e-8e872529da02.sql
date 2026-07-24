
DROP FUNCTION IF EXISTS public.get_current_staff();

-- Staff role expansion (idempotent)
ALTER TABLE public.staff_users DROP CONSTRAINT IF EXISTS staff_users_role_check;
ALTER TABLE public.staff_users
  ADD CONSTRAINT staff_users_role_check
  CHECK (role IN ('owner','admin','librarian','assistant'));
CREATE UNIQUE INDEX IF NOT EXISTS staff_users_one_owner_per_library
  ON public.staff_users (library_id) WHERE role = 'owner';

ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
UPDATE public.invitations SET role = 'admin' WHERE role NOT IN ('admin','librarian','assistant');
ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_role_check CHECK (role IN ('admin','librarian','assistant'));

ALTER TABLE public.libraries ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.libraries DROP CONSTRAINT IF EXISTS libraries_status_check;
ALTER TABLE public.libraries
  ADD CONSTRAINT libraries_status_check CHECK (status IN ('active','suspended'));
ALTER TABLE public.libraries
  ADD COLUMN IF NOT EXISTS patron_portal_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.readers ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform admins read self" ON public.platform_admins;
CREATE POLICY "platform admins read self"
  ON public.platform_admins FOR SELECT TO authenticated USING (id = auth.uid());

CREATE TABLE IF NOT EXISTS public.support_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_admin_id uuid NOT NULL REFERENCES public.platform_admins(id) ON DELETE CASCADE,
  library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE INDEX IF NOT EXISTS support_sessions_active_idx
  ON public.support_sessions (platform_admin_id) WHERE ended_at IS NULL;
GRANT SELECT ON public.support_sessions TO authenticated;
GRANT ALL ON public.support_sessions TO service_role;
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform admin reads own sessions" ON public.support_sessions;
CREATE POLICY "platform admin reads own sessions"
  ON public.support_sessions FOR SELECT TO authenticated USING (platform_admin_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_type text NOT NULL CHECK (actor_type IN ('platform_admin','staff','system')),
  library_id uuid,
  action text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_library_idx ON public.audit_log (library_id, created_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.active_support_library_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT library_id FROM public.support_sessions
   WHERE platform_admin_id = auth.uid() AND ended_at IS NULL
   ORDER BY started_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.in_tenant_scope(_library_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _library_id IS NOT NULL AND (
    _library_id = public.get_user_library_id()
    OR _library_id = public.active_support_library_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_role(_library_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _library_id IS NULL THEN NULL
    WHEN _library_id = public.active_support_library_id() AND public.is_platform_admin() THEN 'admin'
    ELSE (SELECT role FROM public.staff_users
           WHERE id = auth.uid() AND library_id = _library_id AND status = 'active' LIMIT 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_capability(_library_id uuid, _cap text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (SELECT public.current_tenant_role(_library_id) AS role)
  SELECT CASE
    WHEN (SELECT role FROM r) IS NULL THEN false
    WHEN _cap IN ('view','circulation','manage_reservations') THEN (SELECT role FROM r) IN ('owner','admin','librarian','assistant')
    WHEN _cap IN ('manage_books','manage_readers') THEN (SELECT role FROM r) IN ('owner','admin','librarian')
    WHEN _cap IN ('manage_settings','manage_staff') THEN (SELECT role FROM r) IN ('owner','admin')
    WHEN _cap IN ('manage_billing','delete_library') THEN (SELECT role FROM r) = 'owner'
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_reader_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.readers WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.member_portal_open(_library_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT patron_portal_enabled FROM public.libraries WHERE id = _library_id), false);
$$;

CREATE FUNCTION public.get_current_staff()
RETURNS TABLE(id uuid, library_id uuid, email text, full_name text, role text, status text, library_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.library_id, s.email, s.full_name, s.role, s.status, l.status
  FROM public.staff_users s
  LEFT JOIN public.libraries l ON l.id = s.library_id
  WHERE s.id = auth.uid() LIMIT 1;
$$;

-- Tenant RLS rewrites
DROP POLICY IF EXISTS "books: staff library access" ON public.books;
DROP POLICY IF EXISTS "books: tenant access" ON public.books;
DROP POLICY IF EXISTS "books: tenant write" ON public.books;
DROP POLICY IF EXISTS "books: tenant update" ON public.books;
DROP POLICY IF EXISTS "books: tenant delete" ON public.books;
CREATE POLICY "books: tenant access" ON public.books FOR SELECT TO authenticated USING (public.in_tenant_scope(library_id));
CREATE POLICY "books: tenant write" ON public.books FOR INSERT TO authenticated WITH CHECK (public.has_capability(library_id, 'manage_books'));
CREATE POLICY "books: tenant update" ON public.books FOR UPDATE TO authenticated
  USING (public.has_capability(library_id, 'manage_books')) WITH CHECK (public.has_capability(library_id, 'manage_books'));
CREATE POLICY "books: tenant delete" ON public.books FOR DELETE TO authenticated USING (public.has_capability(library_id, 'manage_books'));

DROP POLICY IF EXISTS "readers: staff library access" ON public.readers;
DROP POLICY IF EXISTS "readers: tenant read" ON public.readers;
DROP POLICY IF EXISTS "readers: tenant insert" ON public.readers;
DROP POLICY IF EXISTS "readers: tenant update" ON public.readers;
DROP POLICY IF EXISTS "readers: tenant delete" ON public.readers;
DROP POLICY IF EXISTS "readers: self read" ON public.readers;
CREATE POLICY "readers: tenant read" ON public.readers FOR SELECT TO authenticated USING (public.in_tenant_scope(library_id));
CREATE POLICY "readers: tenant insert" ON public.readers FOR INSERT TO authenticated WITH CHECK (public.has_capability(library_id, 'manage_readers'));
CREATE POLICY "readers: tenant update" ON public.readers FOR UPDATE TO authenticated
  USING (public.has_capability(library_id, 'manage_readers')) WITH CHECK (public.has_capability(library_id, 'manage_readers'));
CREATE POLICY "readers: tenant delete" ON public.readers FOR DELETE TO authenticated USING (public.has_capability(library_id, 'manage_readers'));
CREATE POLICY "readers: self read" ON public.readers FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() AND public.member_portal_open(library_id));

DROP POLICY IF EXISTS "loans: staff library access" ON public.loans;
DROP POLICY IF EXISTS "loans: tenant read" ON public.loans;
DROP POLICY IF EXISTS "loans: tenant insert" ON public.loans;
DROP POLICY IF EXISTS "loans: tenant update" ON public.loans;
DROP POLICY IF EXISTS "loans: self read" ON public.loans;
CREATE POLICY "loans: tenant read" ON public.loans FOR SELECT TO authenticated USING (public.in_tenant_scope(library_id));
CREATE POLICY "loans: tenant insert" ON public.loans FOR INSERT TO authenticated WITH CHECK (public.has_capability(library_id, 'circulation'));
CREATE POLICY "loans: tenant update" ON public.loans FOR UPDATE TO authenticated
  USING (public.has_capability(library_id, 'circulation')) WITH CHECK (public.has_capability(library_id, 'circulation'));
CREATE POLICY "loans: self read" ON public.loans FOR SELECT TO authenticated
  USING (reader_id = public.current_user_reader_id() AND public.member_portal_open(library_id));

DROP POLICY IF EXISTS "reservations: staff library access" ON public.reservations;
DROP POLICY IF EXISTS "reservations: tenant read" ON public.reservations;
DROP POLICY IF EXISTS "reservations: tenant insert" ON public.reservations;
DROP POLICY IF EXISTS "reservations: tenant update" ON public.reservations;
DROP POLICY IF EXISTS "reservations: self read" ON public.reservations;
CREATE POLICY "reservations: tenant read" ON public.reservations FOR SELECT TO authenticated USING (public.in_tenant_scope(library_id));
CREATE POLICY "reservations: tenant insert" ON public.reservations FOR INSERT TO authenticated WITH CHECK (public.has_capability(library_id, 'manage_reservations'));
CREATE POLICY "reservations: tenant update" ON public.reservations FOR UPDATE TO authenticated
  USING (public.has_capability(library_id, 'manage_reservations')) WITH CHECK (public.has_capability(library_id, 'manage_reservations'));
CREATE POLICY "reservations: self read" ON public.reservations FOR SELECT TO authenticated
  USING (reader_id = public.current_user_reader_id() AND public.member_portal_open(library_id));

DROP POLICY IF EXISTS "libraries: read own" ON public.libraries;
DROP POLICY IF EXISTS "libraries: tenant read" ON public.libraries;
DROP POLICY IF EXISTS "owners update own library" ON public.libraries;
DROP POLICY IF EXISTS "libraries: settings update" ON public.libraries;
CREATE POLICY "libraries: tenant read" ON public.libraries FOR SELECT TO authenticated
  USING (public.in_tenant_scope(id) OR public.is_platform_admin());
CREATE POLICY "libraries: settings update" ON public.libraries FOR UPDATE TO authenticated
  USING (public.has_capability(id, 'manage_settings')) WITH CHECK (public.has_capability(id, 'manage_settings'));

DROP POLICY IF EXISTS "owners create invitations" ON public.invitations;
DROP POLICY IF EXISTS "owners read invitations" ON public.invitations;
DROP POLICY IF EXISTS "owners update invitations" ON public.invitations;
DROP POLICY IF EXISTS "owners delete invitations" ON public.invitations;
DROP POLICY IF EXISTS "invitations: staff-manager read" ON public.invitations;
DROP POLICY IF EXISTS "invitations: staff-manager insert" ON public.invitations;
DROP POLICY IF EXISTS "invitations: staff-manager update" ON public.invitations;
DROP POLICY IF EXISTS "invitations: staff-manager delete" ON public.invitations;
CREATE POLICY "invitations: staff-manager read" ON public.invitations FOR SELECT TO authenticated USING (public.has_capability(library_id, 'manage_staff'));
CREATE POLICY "invitations: staff-manager insert" ON public.invitations FOR INSERT TO authenticated WITH CHECK (public.has_capability(library_id, 'manage_staff'));
CREATE POLICY "invitations: staff-manager update" ON public.invitations FOR UPDATE TO authenticated
  USING (public.has_capability(library_id, 'manage_staff')) WITH CHECK (public.has_capability(library_id, 'manage_staff'));
CREATE POLICY "invitations: staff-manager delete" ON public.invitations FOR DELETE TO authenticated USING (public.has_capability(library_id, 'manage_staff'));

DROP POLICY IF EXISTS "owners read library staff" ON public.staff_users;
DROP POLICY IF EXISTS "owners update library staff" ON public.staff_users;
DROP POLICY IF EXISTS "staff read own row" ON public.staff_users;
DROP POLICY IF EXISTS "staff_users: read own" ON public.staff_users;
DROP POLICY IF EXISTS "staff_users: staff-manager read" ON public.staff_users;
DROP POLICY IF EXISTS "staff_users: staff-manager update" ON public.staff_users;
CREATE POLICY "staff_users: read own" ON public.staff_users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "staff_users: staff-manager read" ON public.staff_users FOR SELECT TO authenticated
  USING (public.has_capability(library_id, 'manage_staff'));
CREATE POLICY "staff_users: staff-manager update" ON public.staff_users FOR UPDATE TO authenticated
  USING (public.has_capability(library_id, 'manage_staff') AND (role <> 'owner' OR id = auth.uid()))
  WITH CHECK (public.has_capability(library_id, 'manage_staff') AND (role <> 'owner' OR id = auth.uid()));

DROP POLICY IF EXISTS "audit: platform read all" ON public.audit_log;
DROP POLICY IF EXISTS "audit: tenant staff-manager read" ON public.audit_log;
CREATE POLICY "audit: platform read all" ON public.audit_log FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE POLICY "audit: tenant staff-manager read" ON public.audit_log FOR SELECT TO authenticated
  USING (library_id IS NOT NULL AND public.has_capability(library_id, 'manage_staff'));

CREATE OR REPLACE FUNCTION public.platform_list_libraries()
RETURNS TABLE(id uuid, name text, subdomain text, status text, staff_count bigint, reader_count bigint, book_count bigint, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.name, l.subdomain, l.status,
    (SELECT count(*) FROM public.staff_users s WHERE s.library_id = l.id),
    (SELECT count(*) FROM public.readers r WHERE r.library_id = l.id),
    (SELECT count(*) FROM public.books b WHERE b.library_id = l.id),
    l.created_at
  FROM public.libraries l
  WHERE public.is_platform_admin()
  ORDER BY l.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_library_status(p_library_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.libraries SET status = p_status WHERE id = p_library_id;
  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', p_library_id,
          CASE WHEN p_status = 'suspended' THEN 'library.suspend' ELSE 'library.reactivate' END,
          jsonb_build_object('status', p_status));
END $$;

CREATE OR REPLACE FUNCTION public.start_support_session(p_library_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.libraries WHERE id = p_library_id) THEN
    RAISE EXCEPTION 'Library not found';
  END IF;
  UPDATE public.support_sessions SET ended_at = now()
   WHERE platform_admin_id = auth.uid() AND ended_at IS NULL;
  INSERT INTO public.support_sessions (platform_admin_id, library_id, reason)
  VALUES (auth.uid(), p_library_id, NULLIF(trim(coalesce(p_reason,'')),''))
  RETURNING id INTO v_id;
  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', p_library_id, 'support_session.start',
          jsonb_build_object('session_id', v_id, 'reason', p_reason));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.end_support_session()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lib uuid; v_sid uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT id, library_id INTO v_sid, v_lib FROM public.support_sessions
   WHERE platform_admin_id = auth.uid() AND ended_at IS NULL
   ORDER BY started_at DESC LIMIT 1;
  IF v_sid IS NULL THEN RETURN; END IF;
  UPDATE public.support_sessions SET ended_at = now() WHERE id = v_sid;
  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', v_lib, 'support_session.end', jsonb_build_object('session_id', v_sid));
END $$;

CREATE OR REPLACE FUNCTION public.get_active_support_session()
RETURNS TABLE(id uuid, library_id uuid, library_name text, library_slug text, started_at timestamptz, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.library_id, l.name, l.subdomain, s.started_at, s.reason
  FROM public.support_sessions s
  JOIN public.libraries l ON l.id = s.library_id
  WHERE s.platform_admin_id = auth.uid() AND s.ended_at IS NULL
  ORDER BY s.started_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_context(p_library_id uuid)
RETURNS TABLE(role text, is_support boolean, is_platform_admin boolean, library_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.current_tenant_role(p_library_id),
    (p_library_id = public.active_support_library_id() AND public.is_platform_admin()),
    public.is_platform_admin(),
    (SELECT status FROM public.libraries WHERE id = p_library_id);
$$;

INSERT INTO public.platform_admins (id, email, full_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', u.email)
FROM auth.users u
WHERE lower(u.email) = 'shervinledu@gmail.com'
ON CONFLICT (id) DO NOTHING;
