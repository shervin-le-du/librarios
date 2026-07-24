-- Allow library owner to confirm/edit library name and slug at invitation acceptance.
DROP FUNCTION IF EXISTS public.accept_owner_invitation(text);

CREATE OR REPLACE FUNCTION public.accept_owner_invitation(
  p_token text,
  p_library_name text DEFAULT NULL,
  p_library_slug text DEFAULT NULL
)
 RETURNS TABLE(library_slug text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid;
  v_email text;
  v_full_name text;
  v_inv RECORD;
  v_slug text;
  v_new_slug text;
  v_new_name text;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT email, raw_user_meta_data->>'full_name' INTO v_email, v_full_name
    FROM auth.users WHERE id = v_user;

  SELECT * INTO v_inv FROM public.library_owner_invitations
    WHERE token = p_token FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'This invitation is %', v_inv.status; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'This invitation has expired'; END IF;
  IF lower(v_inv.email) <> lower(v_email) THEN
    RAISE EXCEPTION 'This invitation was sent to %. Please sign in with that email.', v_inv.email;
  END IF;

  -- Optional: rename / re-slug the library at acceptance time
  v_new_name := NULLIF(btrim(p_library_name), '');
  v_new_slug := NULLIF(lower(btrim(p_library_slug)), '');

  IF v_new_slug IS NOT NULL THEN
    IF v_new_slug !~ '^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$' THEN
      RAISE EXCEPTION 'Invalid slug. Use 3-30 lowercase letters, numbers, and hyphens.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.libraries
      WHERE subdomain = v_new_slug AND id <> v_inv.library_id
    ) THEN
      RAISE EXCEPTION 'That URL slug is already taken.';
    END IF;
  END IF;

  UPDATE public.libraries
    SET name = COALESCE(v_new_name, name),
        subdomain = COALESCE(v_new_slug, subdomain),
        status = 'active'
    WHERE id = v_inv.library_id;

  INSERT INTO public.staff_users (id, library_id, email, full_name, role, status)
  VALUES (v_user, v_inv.library_id, v_email, COALESCE(v_full_name, v_email), 'owner', 'active')
  ON CONFLICT (id, library_id) DO UPDATE
    SET role = 'owner', status = 'active';

  UPDATE public.library_owner_invitations SET status = 'accepted' WHERE id = v_inv.id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (v_user, 'staff', v_inv.library_id, 'owner_invitation.accept',
          jsonb_build_object('invitation_id', v_inv.id,
                             'renamed', v_new_name IS NOT NULL,
                             'reslugged', v_new_slug IS NOT NULL));

  SELECT subdomain INTO v_slug FROM public.libraries WHERE id = v_inv.library_id;
  library_slug := v_slug;
  RETURN NEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.accept_owner_invitation(text, text, text) TO authenticated;