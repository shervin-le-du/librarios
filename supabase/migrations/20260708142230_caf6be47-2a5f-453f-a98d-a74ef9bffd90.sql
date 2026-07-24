
-- 1. Extend staff role check to include super_admin
ALTER TABLE public.staff_users DROP CONSTRAINT IF EXISTS staff_users_role_check;
ALTER TABLE public.staff_users ADD CONSTRAINT staff_users_role_check
  CHECK (role = ANY (ARRAY['owner','super_admin','admin','librarian','assistant']::text[]));

-- 2. Extend invitation role check
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
ALTER TABLE public.invitations ADD CONSTRAINT invitations_role_check
  CHECK (role = ANY (ARRAY['super_admin','admin','librarian','assistant']::text[]));

-- 3. Role rank helper
CREATE OR REPLACE FUNCTION public.staff_role_rank(_role text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _role
    WHEN 'owner'       THEN 5
    WHEN 'super_admin' THEN 4
    WHEN 'admin'       THEN 3
    WHEN 'librarian'   THEN 2
    WHEN 'assistant'   THEN 1
    ELSE 0
  END;
$$;

-- 4. Rewritten capability matrix
CREATE OR REPLACE FUNCTION public.has_capability(_library_id uuid, _cap text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH r AS (SELECT public.current_tenant_role(_library_id) AS role)
  SELECT CASE
    WHEN (SELECT role FROM r) IS NULL THEN false
    -- baseline for any staff
    WHEN _cap IN ('view','circulation','manage_reservations')
      THEN (SELECT role FROM r) IN ('owner','super_admin','admin','librarian','assistant')
    -- assistants can now add/edit books and readers
    WHEN _cap IN ('manage_books','manage_readers')
      THEN (SELECT role FROM r) IN ('owner','super_admin','admin','librarian','assistant')
    -- assistants can request deletion; everyone above can too (but they'll delete directly)
    WHEN _cap = 'request_deletion'
      THEN (SELECT role FROM r) IN ('owner','super_admin','admin','librarian','assistant')
    -- direct deletion & approvals: librarian and above
    WHEN _cap IN ('delete_books','delete_readers','approve_deletions')
      THEN (SELECT role FROM r) IN ('owner','super_admin','admin','librarian')
    -- branding / home / emails / general library settings: admin and above
    WHEN _cap IN ('manage_settings','manage_branding','manage_emails')
      THEN (SELECT role FROM r) IN ('owner','super_admin','admin')
    -- inviting/managing librarians & assistants: admin and above
    WHEN _cap = 'manage_staff'
      THEN (SELECT role FROM r) IN ('owner','super_admin','admin')
    -- inviting/managing admins: super_admin and above
    WHEN _cap = 'manage_admins'
      THEN (SELECT role FROM r) IN ('owner','super_admin')
    -- inviting/managing super_admins: owner only
    WHEN _cap = 'manage_super_admins'
      THEN (SELECT role FROM r) = 'owner'
    -- billing / URL slug / delete library: owner only
    WHEN _cap IN ('manage_billing','delete_library','manage_slug')
      THEN (SELECT role FROM r) = 'owner'
    ELSE false
  END;
$$;

-- 5. Enforce hierarchy on staff_users changes (no privilege escalation)
CREATE OR REPLACE FUNCTION public.enforce_staff_role_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_actor_rank int;
  v_target_rank int;
  v_prev_rank int;
BEGIN
  -- Skip enforcement for internal signup flow (SECURITY DEFINER functions with no auth.uid())
  IF v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get actor's role in the relevant library
  SELECT role INTO v_actor_role FROM public.staff_users
    WHERE id = v_actor
      AND library_id = COALESCE(NEW.library_id, OLD.library_id)
      AND status = 'active'
    LIMIT 1;

  -- Platform admins acting via support session bypass this check
  IF v_actor_role IS NULL THEN
    IF public.is_platform_admin() AND
       COALESCE(NEW.library_id, OLD.library_id) = public.active_support_library_id() THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
    RAISE EXCEPTION 'Not authorized to modify staff';
  END IF;

  v_actor_rank := public.staff_role_rank(v_actor_role);

  IF TG_OP = 'INSERT' THEN
    v_target_rank := public.staff_role_rank(NEW.role);
    IF v_target_rank >= v_actor_rank THEN
      RAISE EXCEPTION 'You cannot assign a role at or above your own';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_prev_rank := public.staff_role_rank(OLD.role);
    v_target_rank := public.staff_role_rank(NEW.role);
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      IF v_prev_rank >= v_actor_rank THEN
        RAISE EXCEPTION 'You cannot change the role of someone at or above your rank';
      END IF;
      IF v_target_rank >= v_actor_rank THEN
        RAISE EXCEPTION 'You cannot promote someone to a role at or above your own';
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_prev_rank := public.staff_role_rank(OLD.role);
    IF v_prev_rank >= v_actor_rank THEN
      RAISE EXCEPTION 'You cannot remove someone at or above your rank';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS enforce_staff_role_hierarchy_trg ON public.staff_users;
CREATE TRIGGER enforce_staff_role_hierarchy_trg
BEFORE INSERT OR UPDATE OF role OR DELETE ON public.staff_users
FOR EACH ROW EXECUTE FUNCTION public.enforce_staff_role_hierarchy();

-- 6. Deletion requests table
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('book','reader')),
  entity_id uuid NOT NULL,
  entity_label text,
  reason text,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deletion_requests_lib_status_idx
  ON public.deletion_requests (library_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS deletion_requests_pending_unique_idx
  ON public.deletion_requests (library_id, entity_type, entity_id) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.deletion_requests TO authenticated;
GRANT ALL ON public.deletion_requests TO service_role;

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view deletion requests in their library"
  ON public.deletion_requests FOR SELECT TO authenticated
  USING (public.has_capability(library_id, 'view'));

CREATE POLICY "Staff can create deletion requests"
  ON public.deletion_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.has_capability(library_id, 'request_deletion')
    AND requested_by = auth.uid()
  );

CREATE POLICY "Reviewers or requesters can update deletion requests"
  ON public.deletion_requests FOR UPDATE TO authenticated
  USING (
    public.has_capability(library_id, 'approve_deletions')
    OR (requested_by = auth.uid() AND status = 'pending')
  )
  WITH CHECK (
    public.has_capability(library_id, 'approve_deletions')
    OR (requested_by = auth.uid() AND status IN ('pending','cancelled'))
  );

CREATE OR REPLACE FUNCTION public._deletion_requests_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS deletion_requests_touch ON public.deletion_requests;
CREATE TRIGGER deletion_requests_touch BEFORE UPDATE ON public.deletion_requests
FOR EACH ROW EXECUTE FUNCTION public._deletion_requests_touch();

-- 7. RPCs

-- Request or auto-execute a deletion
CREATE OR REPLACE FUNCTION public.request_entity_deletion(
  p_entity_type text,
  p_entity_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lib uuid;
  v_role text;
  v_label text;
  v_req_id uuid;
  v_can_delete boolean;
BEGIN
  IF p_entity_type NOT IN ('book','reader') THEN
    RAISE EXCEPTION 'Invalid entity type';
  END IF;

  -- Look up entity + library and confirm same-tenant scope
  IF p_entity_type = 'book' THEN
    SELECT library_id, title INTO v_lib, v_label FROM public.books WHERE id = p_entity_id;
  ELSE
    SELECT library_id, first_name || ' ' || last_name INTO v_lib, v_label
      FROM public.readers WHERE id = p_entity_id;
  END IF;

  IF v_lib IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF NOT public.has_capability(v_lib, 'request_deletion') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_can_delete := public.has_capability(
    v_lib,
    CASE WHEN p_entity_type = 'book' THEN 'delete_books' ELSE 'delete_readers' END
  );

  IF v_can_delete THEN
    -- Execute immediately as an auto-approved request for auditability
    INSERT INTO public.deletion_requests (
      library_id, entity_type, entity_id, entity_label, reason,
      requested_by, status, reviewed_by, reviewed_at
    ) VALUES (
      v_lib, p_entity_type, p_entity_id, v_label, NULLIF(trim(coalesce(p_reason,'')),''),
      auth.uid(), 'approved', auth.uid(), now()
    ) RETURNING id INTO v_req_id;

    IF p_entity_type = 'book' THEN
      DELETE FROM public.books WHERE id = p_entity_id;
    ELSE
      DELETE FROM public.readers WHERE id = p_entity_id;
    END IF;

    INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
    VALUES (auth.uid(), 'staff', v_lib,
            CASE WHEN p_entity_type = 'book' THEN 'book.delete' ELSE 'reader.delete' END,
            jsonb_build_object('entity_id', p_entity_id, 'label', v_label, 'via', 'direct'));

    RETURN jsonb_build_object('status', 'deleted', 'request_id', v_req_id);
  END IF;

  -- Otherwise queue a pending request (unique index prevents duplicates)
  INSERT INTO public.deletion_requests (
    library_id, entity_type, entity_id, entity_label, reason, requested_by
  ) VALUES (
    v_lib, p_entity_type, p_entity_id, v_label,
    NULLIF(trim(coalesce(p_reason,'')),''), auth.uid()
  ) RETURNING id INTO v_req_id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'staff', v_lib, 'deletion_request.create',
          jsonb_build_object('entity_type', p_entity_type, 'entity_id', p_entity_id, 'label', v_label));

  RETURN jsonb_build_object('status', 'requested', 'request_id', v_req_id);
END $$;

CREATE OR REPLACE FUNCTION public.approve_deletion_request(p_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.deletion_requests WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;
  IF NOT public.has_capability(r.library_id, 'approve_deletions') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF r.entity_type = 'book' THEN
    DELETE FROM public.books WHERE id = r.entity_id;
  ELSIF r.entity_type = 'reader' THEN
    DELETE FROM public.readers WHERE id = r.entity_id;
  END IF;

  UPDATE public.deletion_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
        review_note = NULLIF(trim(coalesce(p_note,'')),'')
    WHERE id = p_id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'staff', r.library_id, 'deletion_request.approve',
          jsonb_build_object('request_id', p_id, 'entity_type', r.entity_type, 'entity_id', r.entity_id));
END $$;

CREATE OR REPLACE FUNCTION public.reject_deletion_request(p_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.deletion_requests WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;
  IF NOT public.has_capability(r.library_id, 'approve_deletions') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.deletion_requests
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        review_note = NULLIF(trim(coalesce(p_note,'')),'')
    WHERE id = p_id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'staff', r.library_id, 'deletion_request.reject',
          jsonb_build_object('request_id', p_id, 'entity_type', r.entity_type, 'entity_id', r.entity_id));
END $$;

CREATE OR REPLACE FUNCTION public.cancel_deletion_request(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.deletion_requests WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;
  IF r.requested_by <> auth.uid() AND NOT public.has_capability(r.library_id, 'approve_deletions') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.deletion_requests
    SET status = 'cancelled', reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_id;
END $$;

-- List pending requests (with a bit of joined context) for the current library
CREATE OR REPLACE FUNCTION public.list_deletion_requests(p_library_id uuid, p_status text DEFAULT 'pending')
RETURNS TABLE (
  id uuid, entity_type text, entity_id uuid, entity_label text,
  reason text, status text,
  requested_by uuid, requester_name text, requester_email text,
  reviewed_by uuid, reviewer_name text, reviewed_at timestamptz, review_note text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    dr.id, dr.entity_type, dr.entity_id, dr.entity_label,
    dr.reason, dr.status,
    dr.requested_by, s1.full_name, s1.email,
    dr.reviewed_by, s2.full_name, dr.reviewed_at, dr.review_note,
    dr.created_at
  FROM public.deletion_requests dr
  LEFT JOIN public.staff_users s1 ON s1.id = dr.requested_by AND s1.library_id = dr.library_id
  LEFT JOIN public.staff_users s2 ON s2.id = dr.reviewed_by AND s2.library_id = dr.library_id
  WHERE dr.library_id = p_library_id
    AND public.has_capability(p_library_id, 'view')
    AND (p_status IS NULL OR dr.status = p_status)
  ORDER BY dr.created_at DESC;
$$;
