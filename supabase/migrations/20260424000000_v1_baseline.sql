-- =============================================================================
-- LaxStats v1 Baseline Schema
-- Reconstructed from source for staging environment bootstrap.
-- Uses IF NOT EXISTS / DO$$ guards throughout — safe to run against production.
-- =============================================================================

-- ── profiles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  is_admin   boolean     NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_select_own') THEN
    CREATE POLICY profiles_select_own ON profiles FOR SELECT USING (auth.uid() = id OR is_admin);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_update_own') THEN
    CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- Auto-create profile row when a new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  END IF;
END $$;

-- ── games ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS games (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users ON DELETE CASCADE,
  name       text        NOT NULL DEFAULT '',
  state      jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='games' AND policyname='games_select_public') THEN
    CREATE POLICY games_select_public ON games FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='games' AND policyname='games_insert_authenticated') THEN
    CREATE POLICY games_insert_authenticated ON games FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='games' AND policyname='games_update_owner') THEN
    CREATE POLICY games_update_owner ON games FOR UPDATE USING (
      auth.uid() = user_id
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='games' AND policyname='games_delete_owner') THEN
    CREATE POLICY games_delete_owner ON games FOR DELETE USING (
      auth.uid() = user_id
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
    );
  END IF;
END $$;

-- ── saved_teams ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_teams (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users ON DELETE CASCADE,
  name       text        NOT NULL DEFAULT '',
  roster     text        NOT NULL DEFAULT '',
  color      text        NOT NULL DEFAULT '#1a6bab',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE saved_teams ENABLE ROW LEVEL SECURITY;

-- roster_shares must exist before the saved_teams SELECT policy references it
CREATE TABLE IF NOT EXISTS roster_shares (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id            uuid        NOT NULL REFERENCES saved_teams ON DELETE CASCADE,
  shared_with_user_id  uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at           timestamptz DEFAULT now(),
  UNIQUE (roster_id, shared_with_user_id)
);

ALTER TABLE roster_shares ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='saved_teams' AND policyname='saved_teams_select') THEN
    CREATE POLICY saved_teams_select ON saved_teams FOR SELECT USING (
      auth.uid() = user_id
      OR EXISTS (SELECT 1 FROM roster_shares WHERE roster_id = id AND shared_with_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='saved_teams' AND policyname='saved_teams_insert') THEN
    CREATE POLICY saved_teams_insert ON saved_teams FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='saved_teams' AND policyname='saved_teams_update') THEN
    CREATE POLICY saved_teams_update ON saved_teams FOR UPDATE USING (
      auth.uid() = user_id
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='saved_teams' AND policyname='saved_teams_delete') THEN
    CREATE POLICY saved_teams_delete ON saved_teams FOR DELETE USING (
      auth.uid() = user_id
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='roster_shares' AND policyname='roster_shares_select') THEN
    CREATE POLICY roster_shares_select ON roster_shares FOR SELECT USING (
      shared_with_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM saved_teams WHERE id = roster_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='roster_shares' AND policyname='roster_shares_insert') THEN
    CREATE POLICY roster_shares_insert ON roster_shares FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM saved_teams WHERE id = roster_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='roster_shares' AND policyname='roster_shares_delete') THEN
    CREATE POLICY roster_shares_delete ON roster_shares FOR DELETE USING (
      EXISTS (SELECT 1 FROM saved_teams WHERE id = roster_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
    );
  END IF;
END $$;

-- ── RPCs ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION find_user_by_username(p_username text)
RETURNS TABLE (id uuid, display_name text) STABLE SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_email text;
BEGIN
  v_email := CASE WHEN p_username LIKE '%@%' THEN p_username ELSE p_username || '@laxstats.app' END;
  RETURN QUERY
    SELECT u.id,
      COALESCE(
        CASE WHEN u.email LIKE '%@laxstats.app' THEN split_part(u.email,'@',1) ELSE u.email END,
        u.id::text
      ) AS display_name
    FROM auth.users u
    WHERE lower(u.email) = lower(v_email);
END;
$$;

CREATE OR REPLACE FUNCTION get_roster_shares(p_roster_id uuid)
RETURNS TABLE (share_id uuid, shared_with_user_id uuid, display_name text)
STABLE SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
    SELECT rs.id, rs.shared_with_user_id,
      COALESCE(
        CASE WHEN u.email LIKE '%@laxstats.app' THEN split_part(u.email,'@',1) ELSE u.email END,
        rs.shared_with_user_id::text
      ) AS display_name
    FROM roster_shares rs
    JOIN auth.users u ON u.id = rs.shared_with_user_id
    WHERE rs.roster_id = p_roster_id
      AND (
        EXISTS (SELECT 1 FROM saved_teams WHERE id = p_roster_id AND user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
      );
END;
$$;

CREATE OR REPLACE FUNCTION admin_add_roster_share(p_roster_id uuid, p_user_id uuid)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  INSERT INTO roster_shares (roster_id, shared_with_user_id)
    VALUES (p_roster_id, p_user_id) ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION admin_remove_roster_share(p_share_id uuid)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  DELETE FROM roster_shares WHERE id = p_share_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_reassign_game(p_game_id uuid, p_user_id uuid)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE games SET user_id = p_user_id WHERE id = p_game_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_reassign_roster(p_roster_id uuid, p_user_id uuid)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE saved_teams SET user_id = p_user_id WHERE id = p_roster_id;
END;
$$;
