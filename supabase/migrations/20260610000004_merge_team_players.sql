-- =============================================================================
-- "Combine players" merge tool — one player recorded under two jersey numbers
-- (jersey change mid-season, or an in-game placeholder duplicating a real
-- roster entry).
--
-- Transactionally:
--   1. rewrites player {num, name} snapshots on game_events rows for games
--      linked to the team,
--   2. rewrites the player objects inside affected games' state.log JSONB
--      (legacy games still carry a log blob — both stores must agree or
--      season stats and game views would disagree),
--   3. keeps one roster entry under the chosen final number/name and removes
--      the other from the org roster.
--
-- Finalized games' box scores retroactively show the final number — intended.
-- RLS: org_admin / coach of the owning org only.
-- =============================================================================

CREATE OR REPLACE FUNCTION merge_team_players(
  p_team_id          uuid,
  p_keep_player_id   uuid,
  p_remove_player_id uuid,
  p_final_num        text,
  p_final_name       text
) RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_org_id     uuid;
  v_keep_num   text;
  v_remove_num text;
BEGIN
  SELECT org_id INTO v_org_id FROM teams WHERE id = p_team_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'team not found'; END IF;
  IF NOT (is_platform_admin() OR get_org_role(v_org_id) IN ('org_admin','coach')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_keep_player_id = p_remove_player_id THEN
    RAISE EXCEPTION 'cannot merge a player with themselves';
  END IF;
  IF p_final_num IS NULL OR btrim(p_final_num) = '' THEN
    RAISE EXCEPTION 'final jersey number required';
  END IF;
  IF p_final_name IS NULL OR btrim(p_final_name) = '' THEN
    RAISE EXCEPTION 'final player name required';
  END IF;

  SELECT COALESCE(tp.jersey_num, p.number)::text INTO v_keep_num
  FROM team_players tp JOIN players p ON p.id = tp.player_id
  WHERE tp.team_id = p_team_id AND tp.player_id = p_keep_player_id;

  SELECT COALESCE(tp.jersey_num, p.number)::text INTO v_remove_num
  FROM team_players tp JOIN players p ON p.id = tp.player_id
  WHERE tp.team_id = p_team_id AND tp.player_id = p_remove_player_id;

  IF v_keep_num IS NULL OR v_remove_num IS NULL THEN
    RAISE EXCEPTION 'both players must be on the team roster';
  END IF;
  IF p_final_num NOT IN (v_keep_num, v_remove_num) THEN
    RAISE EXCEPTION 'final number must be one of the two merged numbers (% or %)', v_keep_num, v_remove_num;
  END IF;

  -- 1. Rewrite game_events snapshots for this team's games (both numbers → final)
  UPDATE game_events ge
  SET player_num = p_final_num, player_name = p_final_name
  FROM games g
  WHERE ge.game_id = g.id
    AND ((g.home_team_id = p_team_id AND ge.team_idx = 0)
      OR (g.away_team_id = p_team_id AND ge.team_idx = 1))
    AND ge.player_num IN (v_keep_num, v_remove_num);

  -- 2. Rewrite player objects inside legacy games.state.log blobs
  UPDATE games g
  SET state = jsonb_set(g.state, '{log}', sub.new_log)
  FROM (
    SELECT g2.id,
           COALESCE(jsonb_agg(
             CASE
               WHEN e->'player'->>'num' IN (v_keep_num, v_remove_num)
                AND (e->>'teamIdx')::int = CASE WHEN g2.home_team_id = p_team_id THEN 0 ELSE 1 END
               THEN jsonb_set(e, '{player}',
                      (e->'player') || jsonb_build_object('num', p_final_num, 'name', p_final_name))
               ELSE e
             END ORDER BY t.ord
           ), '[]'::jsonb) AS new_log
    FROM games g2
    CROSS JOIN LATERAL jsonb_array_elements(g2.state->'log') WITH ORDINALITY AS t(e, ord)
    WHERE (g2.home_team_id = p_team_id OR g2.away_team_id = p_team_id)
      AND jsonb_typeof(g2.state->'log') = 'array'
    GROUP BY g2.id
  ) sub
  WHERE g.id = sub.id;

  -- 3. Merge the roster entries: keep one under the final number/name
  UPDATE players SET name = p_final_name WHERE id = p_keep_player_id;
  UPDATE team_players
  SET jersey_num = CASE WHEN p_final_num ~ '^\d+$' THEN p_final_num::int ELSE jersey_num END
  WHERE team_id = p_team_id AND player_id = p_keep_player_id;

  DELETE FROM team_players WHERE team_id = p_team_id AND player_id = p_remove_player_id;
  DELETE FROM team_season_roster WHERE team_id = p_team_id AND player_id = p_remove_player_id;
  -- Drop the duplicate from the org pool entirely if no other team references it
  DELETE FROM players p
  WHERE p.id = p_remove_player_id
    AND NOT EXISTS (SELECT 1 FROM team_players tp WHERE tp.player_id = p.id);
END;
$$;

NOTIFY pgrst, 'reload schema';
