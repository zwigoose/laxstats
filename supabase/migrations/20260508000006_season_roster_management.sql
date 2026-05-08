-- Season-specific roster management.
-- team_season_roster already exists (created in v2_schema) but has no RLS and no RPCs.

-- ── 1. Enable RLS on team_season_roster ───────────────────────────────────────
ALTER TABLE team_season_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tsr_select_public" ON team_season_roster FOR SELECT USING (true);

CREATE POLICY "tsr_insert_coach" ON team_season_roster FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
        AND get_org_role(t.org_id) IN ('org_admin','coach')
    )
  );

CREATE POLICY "tsr_update_coach" ON team_season_roster FOR UPDATE
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
        AND get_org_role(t.org_id) IN ('org_admin','coach')
    )
  );

CREATE POLICY "tsr_delete_coach" ON team_season_roster FOR DELETE
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
        AND get_org_role(t.org_id) IN ('org_admin','coach')
    )
  );

-- ── 2. get_season_team_roster ─────────────────────────────────────────────────
-- Returns the roster for a given team in a given season, sorted by jersey then name.
CREATE OR REPLACE FUNCTION get_season_team_roster(p_season_id uuid, p_team_id uuid)
RETURNS TABLE(
  player_id  uuid,
  name       text,
  number     integer,
  "position" text,
  jersey_num integer
)
SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    p.id         AS player_id,
    p.name,
    p.number,
    p.position   AS "position",
    tsr.jersey_num
  FROM team_season_roster tsr
  JOIN players p ON p.id = tsr.player_id
  WHERE tsr.season_id = p_season_id AND tsr.team_id = p_team_id
  ORDER BY COALESCE(tsr.jersey_num, p.number, 9999), p.name;
$$;

GRANT EXECUTE ON FUNCTION get_season_team_roster(uuid, uuid) TO authenticated, anon;

-- ── 3. upsert_season_roster_player ────────────────────────────────────────────
-- Adds a player to a season roster (or updates their jersey if already present).
-- p_jersey_num: null = use the player's canonical number.
CREATE OR REPLACE FUNCTION upsert_season_roster_player(
  p_season_id  uuid,
  p_team_id    uuid,
  p_player_id  uuid,
  p_jersey_num integer DEFAULT NULL
)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT org_id INTO v_org_id FROM teams WHERE id = p_team_id;

  IF NOT is_platform_admin() THEN
    IF get_org_role(v_org_id) NOT IN ('org_admin','coach') THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  -- Verify player belongs to same org
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND org_id = v_org_id) THEN
    RAISE EXCEPTION 'player does not belong to this org';
  END IF;

  INSERT INTO team_season_roster (team_id, season_id, player_id, jersey_num)
  VALUES (p_team_id, p_season_id, p_player_id, p_jersey_num)
  ON CONFLICT (team_id, season_id, player_id)
  DO UPDATE SET jersey_num = EXCLUDED.jersey_num;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_season_roster_player(uuid, uuid, uuid, integer) TO authenticated;

-- ── 4. remove_season_roster_player ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION remove_season_roster_player(
  p_season_id uuid,
  p_team_id   uuid,
  p_player_id uuid
)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    IF get_org_role((SELECT org_id FROM teams WHERE id = p_team_id)) NOT IN ('org_admin','coach') THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  DELETE FROM team_season_roster
  WHERE team_id = p_team_id AND season_id = p_season_id AND player_id = p_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION remove_season_roster_player(uuid, uuid, uuid) TO authenticated;
