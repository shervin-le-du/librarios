
CREATE OR REPLACE FUNCTION public.platform_delete_library(p_library_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_role text; v_name text;
BEGIN
  SELECT role INTO v_role FROM public.platform_admins WHERE id = auth.uid();
  IF v_role NOT IN ('owner','super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT name INTO v_name FROM public.libraries WHERE id = p_library_id;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Library not found'; END IF;

  DELETE FROM public.loans WHERE library_id = p_library_id;
  DELETE FROM public.books WHERE library_id = p_library_id;
  DELETE FROM public.readers WHERE library_id = p_library_id;
  DELETE FROM public.staff_users WHERE library_id = p_library_id;
  DELETE FROM public.libraries WHERE id = p_library_id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (auth.uid(), 'platform_admin', NULL, 'library.delete',
          jsonb_build_object('library_id', p_library_id, 'name', v_name));
END $$;

REVOKE ALL ON FUNCTION public.platform_delete_library(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.platform_delete_library(uuid) TO authenticated;
