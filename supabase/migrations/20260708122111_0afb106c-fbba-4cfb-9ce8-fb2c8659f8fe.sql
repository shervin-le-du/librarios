
-- 1) Repair references to nonexistent staff_users.user_id (schema uses id)
CREATE OR REPLACE FUNCTION public.set_library_visibility(p_library_id uuid, p_visibility text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_role text;
BEGIN
  IF p_visibility NOT IN ('public','private') THEN RAISE EXCEPTION 'Invalid visibility'; END IF;
  SELECT role::text INTO v_role FROM public.staff_users
  WHERE library_id = p_library_id AND id = auth.uid() AND status = 'active' LIMIT 1;
  IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.libraries SET visibility = p_visibility WHERE id = p_library_id;
END $$;

CREATE OR REPLACE FUNCTION public.publish_library(p_library_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_role text; v_now timestamptz := now(); v_snapshot jsonb;
BEGIN
  SELECT role::text INTO v_role FROM public.staff_users
  WHERE library_id = p_library_id AND id = auth.uid() AND status = 'active' LIMIT 1;
  IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT jsonb_build_object(
    'name', name, 'logo_url', logo_url, 'brand_color', brand_color,
    'languages', languages, 'contact_email', contact_email, 'contact_phone', contact_phone,
    'contact_address', contact_address, 'home_page_config', home_page_config,
    'patron_portal_enabled', patron_portal_enabled
  ) INTO v_snapshot FROM public.libraries WHERE id = p_library_id;
  UPDATE public.libraries
  SET published_snapshot = v_snapshot, published_at = v_now,
      home_page_config = jsonb_set(coalesce(home_page_config, '{}'::jsonb), '{published}', 'true'::jsonb)
  WHERE id = p_library_id;
  RETURN v_now;
END $$;

-- 2) Allow multi-library membership: relax onboarding guard and make handle_new_user idempotent
CREATE OR REPLACE FUNCTION public.create_library_for_current_user(p_name text, p_slug text)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user uuid; v_lib uuid; v_email text; v_name text; v_slug text;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'Library name is required'; END IF;

  v_slug := lower(trim(coalesce(p_slug,'')));
  IF length(v_slug) < 3 OR length(v_slug) > 30 THEN RAISE EXCEPTION 'Slug must be 3-30 characters'; END IF;
  IF v_slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' THEN
    RAISE EXCEPTION 'Slug may only contain lowercase letters, numbers, and hyphens (no leading or trailing hyphen)';
  END IF;
  IF v_slug = ANY(ARRAY['www','app','api','admin','mail','static','assets','auth','login','signup','dashboard','support','onboarding','accept-invite','platform']) THEN
    RAISE EXCEPTION 'That slug is reserved';
  END IF;
  IF EXISTS (SELECT 1 FROM public.libraries WHERE subdomain = v_slug) THEN
    RAISE EXCEPTION 'That slug is already taken';
  END IF;

  SELECT email, raw_user_meta_data->>'full_name' INTO v_email, v_name
    FROM auth.users WHERE id = v_user;

  INSERT INTO public.libraries (name, subdomain) VALUES (trim(p_name), v_slug) RETURNING id INTO v_lib;
  INSERT INTO public.staff_users (id, library_id, email, full_name, role, status)
    VALUES (v_user, v_lib, v_email, COALESCE(v_name, v_email), 'owner', 'active');
  RETURN v_lib;
END $$;

-- 3) handle_new_user: keep signup-path acceptance, but make inserts idempotent
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_token text; v_owner RECORD; v_plat RECORD; v_staff RECORD;
BEGIN
  IF lower(NEW.email) = 'shervinledu@gmail.com' THEN
    INSERT INTO public.platform_admins (id, email, full_name, role)
    VALUES (NEW.id, lower(NEW.email),
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            'owner')
    ON CONFLICT (id) DO UPDATE SET role = 'owner';
    RETURN NEW;
  END IF;

  v_token := NEW.raw_user_meta_data->>'owner_invitation_token';
  IF v_token IS NOT NULL AND v_token <> '' THEN
    SELECT * INTO v_owner FROM public.library_owner_invitations
      WHERE token = v_token AND status = 'pending' AND expires_at > now() LIMIT 1;
    IF v_owner.id IS NOT NULL THEN
      INSERT INTO public.staff_users (id, library_id, email, full_name, role, status)
      VALUES (NEW.id, v_owner.library_id, NEW.email,
              COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
              'owner', 'active')
      ON CONFLICT (id, library_id) DO NOTHING;
      UPDATE public.libraries SET status = 'active' WHERE id = v_owner.library_id;
      UPDATE public.library_owner_invitations SET status = 'accepted' WHERE id = v_owner.id;
      RETURN NEW;
    END IF;
  END IF;

  v_token := NEW.raw_user_meta_data->>'platform_invitation_token';
  IF v_token IS NOT NULL AND v_token <> '' THEN
    SELECT * INTO v_plat FROM public.platform_admin_invitations
      WHERE token = v_token AND status = 'pending' AND expires_at > now() LIMIT 1;
    IF v_plat.id IS NOT NULL THEN
      INSERT INTO public.platform_admins (id, email, full_name, role)
      VALUES (NEW.id, NEW.email,
              COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
              v_plat.role)
      ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role
        WHERE public.platform_admins.role <> 'owner';
      UPDATE public.platform_admin_invitations SET status = 'accepted' WHERE id = v_plat.id;
      RETURN NEW;
    END IF;
  END IF;

  v_token := NEW.raw_user_meta_data->>'invitation_token';
  IF v_token IS NULL OR v_token = '' THEN RETURN NEW; END IF;
  SELECT * INTO v_staff FROM public.invitations
    WHERE token = v_token AND status = 'pending' LIMIT 1;
  IF v_staff.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.staff_users (id, library_id, email, full_name, role, status)
  VALUES (NEW.id, v_staff.library_id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
          v_staff.role, 'active')
  ON CONFLICT (id, library_id) DO NOTHING;
  UPDATE public.invitations SET status = 'accepted' WHERE id = v_staff.id;
  RETURN NEW;
END $$;

-- 4) Accept-invite RPCs for already-signed-in users
CREATE OR REPLACE FUNCTION public.accept_owner_invitation(p_token text)
 RETURNS TABLE(library_slug text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user uuid; v_email text; v_full_name text; v_inv RECORD; v_slug text;
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

  INSERT INTO public.staff_users (id, library_id, email, full_name, role, status)
  VALUES (v_user, v_inv.library_id, v_email, COALESCE(v_full_name, v_email), 'owner', 'active')
  ON CONFLICT (id, library_id) DO UPDATE
    SET role = 'owner', status = 'active';

  UPDATE public.libraries SET status = 'active' WHERE id = v_inv.library_id;
  UPDATE public.library_owner_invitations SET status = 'accepted' WHERE id = v_inv.id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (v_user, 'staff', v_inv.library_id, 'owner_invitation.accept',
          jsonb_build_object('invitation_id', v_inv.id));

  SELECT subdomain INTO v_slug FROM public.libraries WHERE id = v_inv.library_id;
  library_slug := v_slug;
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.accept_staff_invitation(p_token text)
 RETURNS TABLE(library_slug text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user uuid; v_email text; v_full_name text; v_inv RECORD; v_slug text;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email, raw_user_meta_data->>'full_name' INTO v_email, v_full_name
    FROM auth.users WHERE id = v_user;

  SELECT * INTO v_inv FROM public.invitations WHERE token = p_token FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'This invitation is %', v_inv.status; END IF;
  IF lower(v_inv.email) <> lower(v_email) THEN
    RAISE EXCEPTION 'This invitation was sent to %. Please sign in with that email.', v_inv.email;
  END IF;

  INSERT INTO public.staff_users (id, library_id, email, full_name, role, status)
  VALUES (v_user, v_inv.library_id, v_email, COALESCE(v_full_name, v_email), v_inv.role, 'active')
  ON CONFLICT (id, library_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'active';

  UPDATE public.invitations SET status = 'accepted' WHERE id = v_inv.id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (v_user, 'staff', v_inv.library_id, 'staff_invitation.accept',
          jsonb_build_object('invitation_id', v_inv.id, 'role', v_inv.role));

  SELECT subdomain INTO v_slug FROM public.libraries WHERE id = v_inv.library_id;
  library_slug := v_slug;
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.accept_platform_invitation(p_token text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user uuid; v_email text; v_full_name text; v_inv RECORD;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email, raw_user_meta_data->>'full_name' INTO v_email, v_full_name
    FROM auth.users WHERE id = v_user;

  SELECT * INTO v_inv FROM public.platform_admin_invitations WHERE token = p_token FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'This invitation is %', v_inv.status; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'This invitation has expired'; END IF;
  IF lower(v_inv.email) <> lower(v_email) THEN
    RAISE EXCEPTION 'This invitation was sent to %. Please sign in with that email.', v_inv.email;
  END IF;

  INSERT INTO public.platform_admins (id, email, full_name, role)
  VALUES (v_user, lower(v_email), COALESCE(v_full_name, v_email), v_inv.role)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role
    WHERE public.platform_admins.role <> 'owner';

  UPDATE public.platform_admin_invitations SET status = 'accepted' WHERE id = v_inv.id;

  INSERT INTO public.audit_log (actor_id, actor_type, library_id, action, detail)
  VALUES (v_user, 'platform_admin', NULL, 'platform_invitation.accept',
          jsonb_build_object('invitation_id', v_inv.id, 'role', v_inv.role));
END $$;

-- 5) Helper: does an account with this email exist? (safe: returns only boolean)
CREATE OR REPLACE FUNCTION public.email_has_account(p_email text)
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email)));
$$;

GRANT EXECUTE ON FUNCTION public.accept_owner_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_platform_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_has_account(text) TO anon, authenticated;
