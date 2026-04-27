-- =============================================================================
-- Per-game multi-scorekeeper override
-- Allows platform admins to enable the multi-scorer invite on any individual
-- v2 game regardless of the org's plan feature flag.
-- =============================================================================

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS multi_scorer_enabled boolean NOT NULL DEFAULT false;

-- ── admin_set_game_multi_scorer ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_set_game_multi_scorer(p_game_id uuid, p_enabled boolean)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE games SET multi_scorer_enabled = p_enabled WHERE id = p_game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_game_multi_scorer(uuid, boolean) TO authenticated;
