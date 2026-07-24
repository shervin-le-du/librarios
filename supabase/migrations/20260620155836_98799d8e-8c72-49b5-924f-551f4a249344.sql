
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.active_support_library_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.in_tenant_scope(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_tenant_role(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_capability(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_user_reader_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.member_portal_open(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.platform_list_libraries() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.platform_set_library_status(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.start_support_session(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.end_support_session() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_active_support_session() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_tenant_context(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.active_support_library_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.in_tenant_scope(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_reader_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_portal_open(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_list_libraries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_library_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_support_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_support_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_support_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_context(uuid) TO authenticated;
