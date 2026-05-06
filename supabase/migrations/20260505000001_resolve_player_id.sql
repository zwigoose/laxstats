-- Automatically resolve player_id on game_events from team_players.
--
-- When a scorer selects a player from an org team roster, only player_num
-- and player_name are written to game_events (the roster text blob strips
-- the UUID). This trigger re-joins team_players at insert time so that
-- player_id is populated whenever the event's team is a linked org team.
-- Ad-hoc players (no match) keep player_id = null as before.

CREATE OR REPLACE FUNCTION game_events_resolve_player_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_id uuid;
BEGIN
  IF NEW.player_id IS NOT NULL OR NEW.player_num IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT CASE NEW.team_idx WHEN 0 THEN home_team_id ELSE away_team_id END
  INTO v_team_id
  FROM games WHERE id = NEW.game_id;

  IF v_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tp.player_id INTO NEW.player_id
  FROM team_players tp
  JOIN players p ON p.id = tp.player_id
  WHERE tp.team_id = v_team_id
    AND COALESCE(tp.jersey_num::text, p.number::text) = NEW.player_num
  LIMIT 1;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_events_resolve_player_id_trigger ON game_events;
CREATE TRIGGER game_events_resolve_player_id_trigger
  BEFORE INSERT ON game_events
  FOR EACH ROW EXECUTE FUNCTION game_events_resolve_player_id();

-- Backfill existing events that have player_num but no player_id
UPDATE game_events ge
SET player_id = (
  SELECT tp.player_id
  FROM games g
  JOIN team_players tp
    ON tp.team_id = CASE ge.team_idx WHEN 0 THEN g.home_team_id ELSE g.away_team_id END
  JOIN players p ON p.id = tp.player_id
  WHERE g.id = ge.game_id
    AND COALESCE(tp.jersey_num::text, p.number::text) = ge.player_num
  LIMIT 1
)
WHERE ge.player_id IS NULL
  AND ge.player_num IS NOT NULL;
