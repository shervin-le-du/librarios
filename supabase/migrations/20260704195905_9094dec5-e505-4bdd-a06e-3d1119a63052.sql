
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public._make_invite_token()
RETURNS text
LANGUAGE sql
SET search_path = public, extensions
AS $function$
  SELECT replace(replace(replace(encode(extensions.gen_random_bytes(24),'base64'),'+','-'),'/','_'),'=','');
$function$;

CREATE OR REPLACE FUNCTION public.create_member_invitation(p_reader_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_lib uuid;
  v_reader_lib uuid;
  v_reader_auth uuid;
  v_portal boolean;
  v_token text;
BEGIN
  v_lib := public.get_user_library_id();
  IF v_lib IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.has_capability(v_lib, 'manage_readers') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT library_id, auth_user_id INTO v_reader_lib, v_reader_auth
    FROM public.readers WHERE id = p_reader_id;
  IF v_reader_lib IS NULL OR v_reader_lib <> v_lib THEN
    RAISE EXCEPTION 'Reader not found';
  END IF;
  IF v_reader_auth IS NOT NULL THEN
    RAISE EXCEPTION 'This reader already has a login';
  END IF;

  SELECT patron_portal_enabled INTO v_portal FROM public.libraries WHERE id = v_lib;
  IF NOT COALESCE(v_portal, false) THEN
    RAISE EXCEPTION 'Member portal is not enabled for this library';
  END IF;

  UPDATE public.member_invitations
     SET status = 'revoked'
   WHERE reader_id = p_reader_id AND status = 'pending';

  v_token := encode(extensions.gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

  INSERT INTO public.member_invitations (library_id, reader_id, token, created_by, expires_at)
  VALUES (v_lib, p_reader_id, v_token, auth.uid(), now() + interval '14 days');

  RETURN v_token;
END $function$;
