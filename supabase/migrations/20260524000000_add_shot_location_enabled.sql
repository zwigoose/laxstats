-- =============================================================================
-- Per-game shot-location override & feature flag
-- Allows platform admins to enable the shot-location overlay on any individual
-- game regardless of the org's plan feature flag.
-- =============================================================================

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS shot_location_enabled boolean NOT NULL DEFAULT false;

-- ── admin_set_game_shot_location ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_set_game_shot_location(p_game_id uuid, p_enabled boolean)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE games SET shot_location_enabled = p_enabled WHERE id = p_game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_game_shot_location(uuid, boolean) TO authenticated;
