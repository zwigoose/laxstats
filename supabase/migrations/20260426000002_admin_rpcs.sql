-- =============================================================================
-- Admin RPC functions (platform admin only throughout)
-- =============================================================================

-- Drop functions whose return type signature changed from v1.
-- CREATE OR REPLACE cannot change return types; drop first.
DROP FUNCTION IF EXISTS admin_get_users() CASCADE;
DROP FUNCTION IF EXISTS admin_get_all_rosters() CASCADE;

-- ── admin_get_users ───────────────────────────────────────────────────────────
-- Returns all auth users joined with their profile (is_admin flag).
CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE (
  id         uuid,
  email      text,
  is_admin   boolean,
  created_at timestamptz
)
SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    u.id,
    u.email,
    COALESCE(p.is_admin, false) AS is_admin,
    u.created_at
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
$$;

-- ── admin_set_admin ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_set_admin(target_id uuid, admin_value boolean)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE profiles SET is_admin = admin_value WHERE id = target_id;
END;
$$;

-- ── admin_delete_user ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_delete_user(target_id uuid)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM auth.users WHERE id = target_id;
END;
$$;

-- ── admin_reassign_game ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_reassign_game(p_game_id uuid, p_user_id uuid)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE games SET user_id = p_user_id WHERE id = p_game_id;
END;
$$;

-- ── admin_create_game ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_create_game(p_user_id uuid, p_name text)
RETURNS uuid
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO games (name, user_id, state)
    VALUES (p_name, p_user_id, NULL)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── admin_get_all_rosters ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_all_rosters()
RETURNS TABLE (
  id         uuid,
  user_id    uuid,
  name       text,
  roster     text,
  color      text,
  created_at timestamptz,
  owner_name text
)
SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    st.id,
    st.user_id,
    st.name,
    st.roster,
    st.color,
    st.created_at,
    u.email AS owner_name
  FROM saved_teams st
  LEFT JOIN auth.users u ON u.id = st.user_id
  ORDER BY u.email, st.name;
$$;

-- ── admin_create_roster ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_create_roster(
  p_user_id uuid,
  p_name    text,
  p_roster  text DEFAULT '',
  p_color   text DEFAULT '#1a6bab'
)
RETURNS uuid
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO saved_teams (user_id, name, roster, color)
    VALUES (p_user_id, p_name, p_roster, p_color)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── admin_reassign_roster ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_reassign_roster(p_roster_id uuid, p_user_id uuid)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE saved_teams SET user_id = p_user_id WHERE id = p_roster_id;
END;
$$;

-- ── admin_add_roster_share ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_add_roster_share(p_roster_id uuid, p_user_id uuid)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO roster_shares (roster_id, shared_with_user_id)
    VALUES (p_roster_id, p_user_id)
    ON CONFLICT DO NOTHING;
END;
$$;

-- ── admin_remove_roster_share ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_remove_roster_share(p_share_id uuid)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM roster_shares WHERE id = p_share_id;
END;
$$;

-- ── get_roster_shares ─────────────────────────────────────────────────────────
-- Returns shares for a roster with display names. Used by AdminSharePanel.
CREATE OR REPLACE FUNCTION get_roster_shares(p_roster_id uuid)
RETURNS TABLE (
  share_id            uuid,
  shared_with_user_id uuid,
  display_name        text
)
SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    rs.id    AS share_id,
    rs.shared_with_user_id,
    u.email  AS display_name
  FROM roster_shares rs
  JOIN auth.users u ON u.id = rs.shared_with_user_id
  WHERE rs.roster_id = p_roster_id
  ORDER BY u.email;
$$;
