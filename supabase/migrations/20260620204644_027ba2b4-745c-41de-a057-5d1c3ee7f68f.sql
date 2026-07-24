CREATE OR REPLACE FUNCTION public.get_platform_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_totals jsonb;
  v_growth jsonb;
  v_activity jsonb;
  v_top jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'libraries_total', (SELECT count(*) FROM public.libraries),
    'libraries_active', (SELECT count(*) FROM public.libraries WHERE status = 'active'),
    'libraries_suspended', (SELECT count(*) FROM public.libraries WHERE status = 'suspended'),
    'staff_total', (SELECT count(*) FROM public.staff_users),
    'readers_total', (SELECT count(*) FROM public.readers),
    'books_total', (SELECT count(*) FROM public.books),
    'loans_active', (SELECT count(*) FROM public.loans WHERE status = 'active'),
    'loans_overdue', (SELECT count(*) FROM public.loans WHERE status = 'active' AND due_date < current_date),
    'reservations_active', (SELECT count(*) FROM public.reservations WHERE status = 'active'),
    'support_sessions_active', (SELECT count(*) FROM public.support_sessions WHERE ended_at IS NULL)
  ) INTO v_totals;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('day', day, 'new_libraries', n) ORDER BY day), '[]'::jsonb)
    INTO v_growth
  FROM (
    SELECT d::date AS day,
           (SELECT count(*) FROM public.libraries l
              WHERE l.created_at::date = d::date) AS n
    FROM generate_series(current_date - interval '29 days', current_date, interval '1 day') d
  ) g;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'created_at', a.created_at,
    'actor_id', a.actor_id,
    'actor_type', a.actor_type,
    'action', a.action,
    'library_id', a.library_id,
    'library_name', l.name,
    'detail', a.detail
  ) ORDER BY a.created_at DESC), '[]'::jsonb)
    INTO v_activity
  FROM (
    SELECT * FROM public.audit_log ORDER BY created_at DESC LIMIT 20
  ) a
  LEFT JOIN public.libraries l ON l.id = a.library_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id, 'name', t.name, 'subdomain', t.subdomain, 'status', t.status,
    'book_count', t.book_count, 'reader_count', t.reader_count, 'staff_count', t.staff_count
  ) ORDER BY t.book_count DESC), '[]'::jsonb)
    INTO v_top
  FROM (
    SELECT l.id, l.name, l.subdomain, l.status,
      (SELECT count(*) FROM public.books b WHERE b.library_id = l.id) AS book_count,
      (SELECT count(*) FROM public.readers r WHERE r.library_id = l.id) AS reader_count,
      (SELECT count(*) FROM public.staff_users s WHERE s.library_id = l.id) AS staff_count
    FROM public.libraries l
    ORDER BY book_count DESC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'totals', v_totals,
    'growth_30d', v_growth,
    'recent_activity', v_activity,
    'top_libraries', v_top
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_platform_overview() TO authenticated;