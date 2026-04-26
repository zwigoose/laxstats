-- =============================================================================
-- Per-game pressbox override
-- Allows platform admins to enable the pressbox link on any individual game
-- regardless of the org's plan feature flag.  Useful for personal games and
-- for one-off showcasing without changing the org's plan.
-- =============================================================================

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS pressbox_enabled boolean NOT NULL DEFAULT false;

-- ── admin_set_game_pressbox ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_set_game_pressbox(p_game_id uuid, p_enabled boolean)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE games SET pressbox_enabled = p_enabled WHERE id = p_game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_game_pressbox(uuid, boolean) TO authenticated;
