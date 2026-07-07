import { MomentumTracker } from "laxstats";
import { LOG, LIVE_LOG, TEAMS, TEAM_COLORS, LIVE_QUARTER } from "./_fixtures";

// Full-game momentum line — positive band = home control.
export const FullGame = () => (
  <MomentumTracker log={LOG} teams={TEAMS} teamColors={TEAM_COLORS} currentQuarter={4} gameOver />
);

// Live mid-game state — series building through Q2.
export const LiveGame = () => (
  <MomentumTracker log={LIVE_LOG} teams={TEAMS} teamColors={TEAM_COLORS} currentQuarter={LIVE_QUARTER} />
);

// Pre-game empty state — flat neutral line with explainer.
export const EmptyState = () => (
  <MomentumTracker log={[]} teams={TEAMS} teamColors={TEAM_COLORS} currentQuarter={1} />
);
