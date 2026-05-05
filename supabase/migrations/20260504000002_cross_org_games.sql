-- Cross-org game support
-- Adds away_season_id so the away org can attribute the game to their own season.
-- Adds an RPC to set it, guarded to org_admin of the away org.

ALTER TABLE games ADD COLUMN IF NOT EXISTS away_season_id uuid REFERENCES seasons;

CREATE OR REPLACE FUNCTION link_game_to_away_season(p_game_id uuid, p_season_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_away_org_id uuid;
BEGIN
  SELECT away_org_id INTO v_away_org_id FROM games WHERE id = p_game_id;

  IF v_away_org_id IS NULL THEN
    RAISE EXCEPTION 'Game has no away org set';
  END IF;

  IF NOT (is_platform_admin() OR get_org_role(v_away_org_id) = 'org_admin') THEN
    RAISE EXCEPTION 'Not authorized — must be an org_admin of the away org';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM seasons WHERE id = p_season_id AND org_id = v_away_org_id) THEN
    RAISE EXCEPTION 'Season does not belong to the away org';
  END IF;

  UPDATE games SET away_season_id = p_season_id WHERE id = p_game_id;
END;
$$;
REVOKE ALL ON FUNCTION link_game_to_away_season(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION link_game_to_away_season(uuid, uuid) TO authenticated;
