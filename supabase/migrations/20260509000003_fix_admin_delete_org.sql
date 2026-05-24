-- Fix admin_delete_org: scorekeeper invites are stored in game_scorekeepers,
-- not a separate scorekeeper_invites table.
CREATE OR REPLACE FUNCTION admin_delete_org(p_org_id uuid)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;

  -- 1. Transfer games where this org was home AND a shared away org exists.
  UPDATE games
  SET
    org_id       = away_org_id,
    away_org_id  = NULL,
    season_id    = NULL,
    home_team_id = away_team_id,
    away_team_id = NULL
  WHERE org_id = p_org_id AND away_org_id IS NOT NULL;

  -- 2. Null out away_org_id where this org was the away org.
  UPDATE games SET away_org_id = NULL WHERE away_org_id = p_org_id;

  -- 3. Null out any remaining team FKs pointing to this org's teams.
  UPDATE games SET home_team_id = NULL
    WHERE home_team_id IN (SELECT id FROM teams WHERE org_id = p_org_id);
  UPDATE games SET away_team_id = NULL
    WHERE away_team_id IN (SELECT id FROM teams WHERE org_id = p_org_id);

  -- 4. Delete scorekeeper rows for owned games.
  DELETE FROM game_scorekeepers
    WHERE game_id IN (SELECT id FROM games WHERE org_id = p_org_id);

  -- 5. Delete owned games (game_events CASCADEs).
  DELETE FROM games WHERE org_id = p_org_id;

  -- 6. Delete team rosters before teams.
  DELETE FROM team_players WHERE team_id IN (SELECT id FROM teams WHERE org_id = p_org_id);

  -- 7. Delete players pool.
  DELETE FROM players WHERE org_id = p_org_id;

  -- 8. Delete teams.
  DELETE FROM teams WHERE org_id = p_org_id;

  -- 9. Delete seasons.
  DELETE FROM seasons WHERE org_id = p_org_id;

  -- 10. Delete memberships.
  DELETE FROM org_members WHERE org_id = p_org_id;

  -- 11. Delete per-org feature overrides.
  DELETE FROM org_feature_overrides WHERE org_id = p_org_id;

  -- 12. Delete org.
  DELETE FROM organizations WHERE id = p_org_id;
END;
$$;
