-- =============================================================================
-- Fix org member lookup functions
--
-- 1. find_user_by_username: only matched username@laxstats.app; now also
--    matches users whose email local-part equals the given username, so that
--    real-email accounts (e.g. coach@gmail.com) can be found by typing "coach".
--
-- 2. invite_org_member: same lookup gap — now uses the same broadened search.
--
-- 3. Explicit GRANT EXECUTE for org-member RPCs in case PostgREST role
--    permissions were not inherited from PUBLIC default.
-- =============================================================================

-- 1. find_user_by_username ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION find_user_by_username(p_username text)
RETURNS TABLE (id uuid, display_name text)
STABLE SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_email text;
BEGIN
  -- If the caller passed a full email, use it as-is; otherwise try both
  -- username@laxstats.app (managed accounts) and any email whose local part
  -- matches (real-email accounts like coach@gmail.com).
  v_email := CASE WHEN p_username LIKE '%@%' THEN p_username ELSE p_username || '@laxstats.app' END;

  RETURN QUERY
    SELECT u.id,
      COALESCE(
        CASE WHEN u.email LIKE '%@laxstats.app' THEN split_part(u.email,'@',1) ELSE u.email END,
        u.id::text
      ) AS display_name
    FROM auth.users u
    WHERE lower(u.email) = lower(v_email)
       OR (
            -- Only broaden the search when no @ was given, to avoid
            -- ambiguous matches when a full email was explicitly typed.
            p_username NOT LIKE '%@%'
            AND lower(split_part(u.email, '@', 1)) = lower(p_username)
            AND lower(u.email) <> lower(v_email)  -- avoid double-counting @laxstats.app
          )
    LIMIT 1;
END;
$$;

-- 2. invite_org_member ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION invite_org_member(p_org_id uuid, p_username text, p_role text)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_email   text;
  v_user_id uuid;
BEGIN
  IF NOT (is_platform_admin() OR get_org_role(p_org_id) = 'org_admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_role NOT IN ('org_admin','coach','scorekeeper','viewer') THEN
    RAISE EXCEPTION 'invalid role: %', p_role;
  END IF;

  v_email := CASE WHEN p_username LIKE '%@%' THEN p_username ELSE p_username || '@laxstats.app' END;

  -- Try exact email match first, then fall back to email-local-part match
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;

  IF v_user_id IS NULL AND p_username NOT LIKE '%@%' THEN
    SELECT id INTO v_user_id FROM auth.users
      WHERE lower(split_part(email, '@', 1)) = lower(p_username)
      LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;

  INSERT INTO org_members (org_id, user_id, role)
    VALUES (p_org_id, v_user_id, p_role)
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

-- 3. GRANT EXECUTE ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION find_user_by_username(text)         TO authenticated;
GRANT EXECUTE ON FUNCTION get_org_members(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION invite_org_member(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_org_member(uuid, uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION get_org_role(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_org_ids()                    TO authenticated;
