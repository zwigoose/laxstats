import { PlayerStatsTable, PLAYER_STAT_KEYS } from "laxstats";
import { TEAMS, TEAM_COLORS, PLAYER_STATS } from "./_fixtures";

// Full box score, both teams — the ViewGame/LaxStats usage.
export const BothTeams = () => (
  <PlayerStatsTable
    teams={TEAMS}
    teamColors={TEAM_COLORS}
    playerStats={PLAYER_STATS}
    statKeys={PLAYER_STAT_KEYS}
  />
);

// Condensed single-team panel with a goalie decision — the Pressbox usage.
export const SingleTeamCompact = () => (
  <PlayerStatsTable
    teams={TEAMS}
    teamColors={TEAM_COLORS}
    playerStats={PLAYER_STATS}
    statKeys={PLAYER_STAT_KEYS}
    teamIdx={0}
    compact
    goalieDecisions={{ win: { teamIdx: 0, num: "30" }, loss: { teamIdx: 1, num: "1" } }}
  />
);
