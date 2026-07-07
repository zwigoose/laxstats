import { ShotMap } from "laxstats";
import { LOG, TEAMS, TEAM_COLORS } from "./_fixtures";

// Per-zone shot chart for a full game — shots-goals · shooting % per zone.
export const FullGame = () => (
  <ShotMap log={LOG} teams={TEAMS} teamColors={TEAM_COLORS} />
);
