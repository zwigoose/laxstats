import { GameTimeline } from "laxstats";
import { TEAMS, TEAM_COLORS, SCORING_TIMELINE, LIVE_SCORING_TIMELINE } from "./_fixtures";

// Full-game scoring timeline — the ViewGame usage.
export const FullGame = () => (
  <GameTimeline scoringTimeline={SCORING_TIMELINE} teams={TEAMS} teamColors={TEAM_COLORS} />
);

// Compact live timeline — the Pressbox usage (tighter cells, in-progress game).
export const CompactLive = () => (
  <GameTimeline scoringTimeline={LIVE_SCORING_TIMELINE} teams={TEAMS} teamColors={TEAM_COLORS} compact />
);
