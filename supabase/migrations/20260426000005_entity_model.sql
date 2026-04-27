-- =============================================================================
-- LaxStats — Entity model refactor
--
-- Players are org-level entities.
-- team_players: season-agnostic roster (player belongs to a team).
-- season_teams: a team participates in a season.
-- team_season_roster: a player's slot on a team for a specific season (with
--   optional jersey number override; remains the source of truth for
--   v_season_player_stats aggregations).
--
-- Also cleans up the wrong players.team_id column that was added ad-hoc.
-- =============================================================================

-- 1. Ensure players has canonical number + position columns
ALTER TABLE players ADD COLUMN IF NOT EXISTS number   integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS position text;

-- 2. Create team_players ───────────────────────────────────────────────────────
--    Season-agnostic: "this player is on this team".
CREATE TABLE IF NOT EXISTS team_players (
  team_id    uuid    NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
  player_id  uuid    NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  jersey_num integer,          -- overrides player.number for this team; null = use player.number
  PRIMARY KEY (team_id, player_id)
);

ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_players_select_public"
  ON team_players FOR SELECT USING (true);

CREATE POLICY "team_players_insert_coach"
  ON team_players FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
        AND get_org_role(t.org_id) IN ('org_admin','coach')
    )
  );

CREATE POLICY "team_players_update_coach"
  ON team_players FOR UPDATE
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
        AND get_org_role(t.org_id) IN ('org_admin','coach')
    )
  );

CREATE POLICY "team_players_delete_coach"
  ON team_players FOR DELETE
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
        AND get_org_role(t.org_id) IN ('org_admin','coach')
    )
  );

-- 3. Migrate existing players.team_id rows into team_players ──────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'team_id'
  ) THEN
    INSERT INTO team_players (team_id, player_id, jersey_num)
    SELECT team_id, id, number
    FROM players
    WHERE team_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    ALTER TABLE players DROP COLUMN team_id;
  END IF;
END $$;

-- 4. Create season_teams ──────────────────────────────────────────────────────
--    A team participates in a season. Independent of roster — a team can be
--    added to a season before its roster is finalized.
CREATE TABLE IF NOT EXISTS season_teams (
  season_id  uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id    uuid NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
  PRIMARY KEY (season_id, team_id)
);

ALTER TABLE season_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "season_teams_select_public"
  ON season_teams FOR SELECT USING (true);

CREATE POLICY "season_teams_insert_coach"
  ON season_teams FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
        AND get_org_role(t.org_id) IN ('org_admin','coach')
    )
  );

CREATE POLICY "season_teams_delete_coach"
  ON season_teams FOR DELETE
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
        AND get_org_role(t.org_id) IN ('org_admin','coach')
    )
  );

-- 5. Fix team_season_roster.jersey_num type and nullability ──────────────────
--    Original schema (00001) created it as text. All jersey numbers are
--    integers; change the type so COALESCE with players.number (integer) works.
--    Also drop NOT NULL — null means "use the player's canonical number".
ALTER TABLE team_season_roster ALTER COLUMN jersey_num TYPE integer USING jersey_num::integer;
ALTER TABLE team_season_roster ALTER COLUMN jersey_num DROP NOT NULL;

-- 6. RPC: add_team_to_season ───────────────────────────────────────────────────
--    Adds a team to a season AND pre-populates team_season_roster from
--    team_players so season stats work immediately.
CREATE OR REPLACE FUNCTION add_team_to_season(p_season_id uuid, p_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Idempotent: insert into season_teams
  INSERT INTO season_teams (season_id, team_id)
  VALUES (p_season_id, p_team_id)
  ON CONFLICT DO NOTHING;

  -- Pre-populate season roster from the team's base roster
  INSERT INTO team_season_roster (team_id, season_id, player_id, jersey_num)
  SELECT
    p_team_id,
    p_season_id,
    tp.player_id,
    COALESCE(tp.jersey_num, p.number)
  FROM team_players tp
  JOIN players p ON p.id = tp.player_id
  WHERE tp.team_id = p_team_id
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION add_team_to_season(uuid, uuid) TO authenticated;
