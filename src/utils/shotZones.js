// Six-zone shot map geometry, in the field viewBox (0 0 120 110):
//   y=0 midfield · y=40 restraining line · y=90 goal line · y=110 end line
// Close band (y 65→90, goal line to halfway-to-restraining): L1 / C1 / R1
// Far band   (y 0→65):                                       L2 / C2 / R2
// Columns are left/center/right thirds: x < 40 · 40–80 · > 80.
// Behind the goal line extended (y > 90) is not a valid shot origin — legacy
// points there were mis-taps and are clamped to the goal line before bucketing.

export const SHOT_ZONES = ["L1", "C1", "R1", "L2", "C2", "R2"];

export const ZONE_BANDS = { closeTop: 65, goalLine: 90 };

/**
 * Bucket a normalized (0–1) shot coordinate into one of the six zones.
 * x/y are normalized against the 120×110 viewBox (the format stored in
 * legacy shot_x/shot_y columns and legacy in-state log entries).
 * Returns null when no coordinates were recorded.
 */
export function pointToZone(x, y) {
  if (x == null || y == null) return null;
  const vx = x * 120;
  const vy = Math.min(y * 110, ZONE_BANDS.goalLine); // clamp behind-GLE mis-taps
  const band = vy >= ZONE_BANDS.closeTop ? "1" : "2";
  const col = vx < 40 ? "L" : vx > 80 ? "R" : "C";
  return col + band;
}

/** Zone for a log entry — prefers the stored zone, falls back to legacy x/y. */
export function entryZone(entry) {
  return entry.zone ?? pointToZone(entry.shotX, entry.shotY);
}
