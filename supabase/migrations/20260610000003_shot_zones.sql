-- Replace freeform shot coordinates with the six-zone shot map.
-- Zone geometry mirrors src/utils/shotZones.js (pointToZone) against the
-- 120×110 field viewBox: columns x<40 | 40–80 | >80, close band vy 65→90,
-- far band vy 0→65. Legacy points behind the goal line (vy > 90) were
-- mis-taps and are clamped to the goal line (always close band).

ALTER TABLE game_events
  ADD COLUMN shot_zone text
    CHECK (shot_zone IN ('L1','C1','R1','L2','C2','R2'));

-- Backfill from the normalized 0–1 coordinates
UPDATE game_events
SET shot_zone =
  CASE WHEN shot_x * 120 < 40 THEN 'L' WHEN shot_x * 120 > 80 THEN 'R' ELSE 'C' END
  ||
  CASE WHEN LEAST(shot_y * 110, 90) >= 65 THEN '1' ELSE '2' END
WHERE shot_x IS NOT NULL AND shot_y IS NOT NULL;

ALTER TABLE game_events
  DROP COLUMN shot_x,
  DROP COLUMN shot_y;

NOTIFY pgrst, 'reload schema';
