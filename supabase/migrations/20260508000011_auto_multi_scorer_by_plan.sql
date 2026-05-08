-- Auto-set multi_scorer_enabled on game creation based on the org's plan.
-- Max orgs (multi_scorekeeper limit > 0) get it enabled automatically.
-- Pro orgs (limit = 0) do not.

CREATE OR REPLACE FUNCTION create_org_game(
  p_org_id       uuid,
  p_name         text,
  p_season_id    uuid        DEFAULT NULL,
  p_away_org_id  uuid        DEFAULT NULL,
  p_game_type    text        DEFAULT 'regular',
  p_game_date    date        DEFAULT NULL
)
RETURNS uuid SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_limit           int;
  v_current         bigint;
  v_id              uuid;
  v_multi_scorer    boolean;
BEGIN
  IF NOT (is_platform_admin() OR get_org_role(p_org_id) IN ('org_admin','coach','scorekeeper')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_season_id IS NOT NULL THEN
    v_limit := org_feature_limit(p_org_id, 'org_games_per_season');
    IF v_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_current
        FROM games
        WHERE season_id = p_season_id AND org_id = p_org_id;
      IF v_current >= v_limit THEN
        RAISE EXCEPTION 'plan_limit_exceeded:org_games_per_season:%:%', v_current, v_limit;
      END IF;
    END IF;
  END IF;

  -- Enable multi-scorer if the org's plan allows it (limit > 0 or unlimited).
  v_multi_scorer := COALESCE(org_feature_limit(p_org_id, 'multi_scorekeeper'), 1) > 0;

  INSERT INTO games (name, state, user_id, org_id, away_org_id, season_id, game_type, game_date, schema_ver, multi_scorer_enabled)
    VALUES (p_name, NULL, auth.uid(), p_org_id, p_away_org_id, p_season_id, p_game_type, p_game_date, 2, v_multi_scorer)
    RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_org_game(uuid, text, uuid, uuid, text, date) TO authenticated;
