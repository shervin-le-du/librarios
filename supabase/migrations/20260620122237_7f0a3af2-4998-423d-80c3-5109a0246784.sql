
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_membership_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_library_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.checkout_book(uuid, uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.return_loan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_library_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_book(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_loan(uuid) TO authenticated;
