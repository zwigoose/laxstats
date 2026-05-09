-- Fix admin_delete_org: properly transfer cross-org shared games before deleting.
-- Also add color to admin_get_orgs return.

-- ── admin_delete_org ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_delete_org(p_org_id uuid)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;

  -- 1. Transfer games where this org was home AND a shared away org exists.
  --    The surviving org inherits the game. Swap teams so the surviving org's
  --    team is now the home team. Clear season (it belongs to deleted org).
  UPDATE games
  SET
    org_id       = away_org_id,
    away_org_id  = NULL,
    season_id    = NULL,
    home_team_id = away_team_id,
    away_team_id = NULL
  WHERE org_id = p_org_id AND away_org_id IS NOT NULL;

  -- 2. Null out away_org_id where this org was the away org (game stays with home org).
  UPDATE games SET away_org_id = NULL WHERE away_org_id = p_org_id;

  -- 3. Null out any remaining team FKs pointing to this org's teams
  --    (e.g. other orgs' games that had this org's team as an opponent).
  UPDATE games SET home_team_id = NULL
    WHERE home_team_id IN (SELECT id FROM teams WHERE org_id = p_org_id);
  UPDATE games SET away_team_id = NULL
    WHERE away_team_id IN (SELECT id FROM teams WHERE org_id = p_org_id);

  -- 4. Delete scorekeeper rows for owned games (no guaranteed CASCADE).
  DELETE FROM game_scorekeepers
    WHERE game_id IN (SELECT id FROM games WHERE org_id = p_org_id);

  -- 5. Delete owned games (game_events and game_scorekeepers CASCADE).
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

-- ── admin_get_orgs — add color column ─────────────────────────────────────────
DROP FUNCTION IF EXISTS admin_get_orgs();
CREATE OR REPLACE FUNCTION admin_get_orgs()
RETURNS TABLE (
  id           uuid,
  name         text,
  slug         text,
  plan         text,
  plan_status  text,
  color        text,
  created_at   timestamptz,
  member_count bigint,
  game_count   bigint,
  season_count bigint,
  team_count   bigint
)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT
      o.id, o.name, o.slug, o.plan, o.plan_status, o.color, o.created_at,
      COUNT(DISTINCT om.id)  AS member_count,
      COUNT(DISTINCT g.id)   AS game_count,
      COUNT(DISTINCT s.id)   AS season_count,
      COUNT(DISTINCT t.id)   AS team_count
    FROM organizations o
    LEFT JOIN org_members om ON om.org_id = o.id
    LEFT JOIN games       g  ON g.org_id  = o.id
    LEFT JOIN seasons     s  ON s.org_id  = o.id
    LEFT JOIN teams       t  ON t.org_id  = o.id
    GROUP BY o.id
    ORDER BY o.created_at DESC;
END;
$$;
