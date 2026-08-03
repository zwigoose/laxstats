-- Shot location tracking was previously admin opt-in per game (default
-- false). Flip it to on-by-default for every game, going forward and
-- retroactively. Purely a per-game boolean, not gated by any plan_features
-- row, so no billing/entitlement interaction. The existing admin toggle
-- (admin_set_game_shot_location, surfaced in AdminGameRow.jsx) still works
-- to opt a specific game back out.

ALTER TABLE games ALTER COLUMN shot_location_enabled SET DEFAULT true;

UPDATE games SET shot_location_enabled = true WHERE shot_location_enabled = false;
