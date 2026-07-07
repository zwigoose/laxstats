import { GameLiveStream } from "laxstats";
import { LOG, LIVE_LOG, TEAMS, TEAM_COLORS, COMPLETED_QUARTERS, LIVE_COMPLETED_QUARTERS } from "./_fixtures";

// Live feed mid-game — Q2 in progress, newest events on top.
export const LiveGame = () => (
  <GameLiveStream
    log={LIVE_LOG}
    teams={TEAMS}
    teamColors={TEAM_COLORS}
    completedQuarters={LIVE_COMPLETED_QUARTERS}
    gameOver={false}
  />
);

// Completed game — every quarter final.
export const FinalGame = () => (
  <GameLiveStream
    log={LOG}
    teams={TEAMS}
    teamColors={TEAM_COLORS}
    completedQuarters={COMPLETED_QUARTERS}
    gameOver
  />
);
