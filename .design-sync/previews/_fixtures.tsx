// Shared fixture data for LaxStats preview cards.
//
// One realistic game — Notre Dame Prep 8, Malvern Prep 6 — expressed as the
// event-sourced log the app actually stores, then run through the repo's own
// stats builders so every derived shape (playerStats, scoringTimeline) is
// correct by construction. Goals commit as shot+goal pairs sharing a groupId
// with the zone stamped on both, exactly like the scorekeeper logs them.
import { buildPlayerStats, buildScoringTimeline } from "../../src/utils/stats";

export const TEAMS = [
  {
    name: "Notre Dame Prep",
    color: "#1a6bab",
    roster: [
      "2 Luke Moretti", "4 Jack Sullivan", "7 Brendan Kelly", "9 Chris Dunn",
      "11 Matt Rowan", "15 Tommy Vance", "18 Cole Barrett", "22 Danny Reyes",
      "24 Aiden Walsh", "30 Sam Whitaker",
    ].join("\n"),
  },
  {
    name: "Malvern Prep",
    color: "#b84e1a",
    roster: [
      "1 Owen Price", "3 Will Hartman", "5 Eddie Cross", "8 Nate Boland",
      "10 Ryan Pierce", "12 Charlie Webb", "14 Gavin Ott", "19 Miles Turner",
      "21 Beckett Shaw", "26 Theo Lang",
    ].join("\n"),
  },
];
export const TEAM_COLORS = [TEAMS[0].color, TEAMS[1].color];

// Player handles
const ndp = {
  moretti: { num: "2", name: "Luke Moretti" },
  sullivan: { num: "4", name: "Jack Sullivan" },
  kelly: { num: "7", name: "Brendan Kelly" },
  dunn: { num: "9", name: "Chris Dunn" },
  rowan: { num: "11", name: "Matt Rowan" },
  vance: { num: "15", name: "Tommy Vance" },
  barrett: { num: "18", name: "Cole Barrett" },
  reyes: { num: "22", name: "Danny Reyes" },
  walsh: { num: "24", name: "Aiden Walsh" },
  whitaker: { num: "30", name: "Sam Whitaker" }, // G
};
const mal = {
  price: { num: "1", name: "Owen Price" }, // G
  hartman: { num: "3", name: "Will Hartman" },
  cross: { num: "5", name: "Eddie Cross" },
  boland: { num: "8", name: "Nate Boland" },
  pierce: { num: "10", name: "Ryan Pierce" },
  webb: { num: "12", name: "Charlie Webb" },
  ott: { num: "14", name: "Gavin Ott" },
  turner: { num: "19", name: "Miles Turner" },
  shaw: { num: "21", name: "Beckett Shaw" },
  lang: { num: "26", name: "Theo Lang" },
};
const GOALIES = [ndp.whitaker, mal.price];

let seq = 0;
let gid = 0;
const grp = () => `g${++gid}`;
const e = (event, teamIdx, quarter, player, extra = {}) => ({
  id: ++seq,
  seq,
  groupId: extra.groupId ?? grp(),
  event,
  teamIdx,
  quarter,
  player,
  ...extra,
});

// A goal: shot + goal pair (zone on both) + goal_allowed for the beaten goalie.
const goal = (ti, q, time, scorer, zone, opts: { assist?: any; emo?: boolean } = {}) => {
  const g = grp();
  const rows = [
    e("shot", ti, q, scorer, { groupId: g, zone }),
    e("goal", ti, q, scorer, { groupId: g, zone, goalTime: time, ...(opts.emo ? { emo: true } : {}) }),
    e("goal_allowed", 1 - ti, q, GOALIES[1 - ti], { groupId: g }),
  ];
  if (opts.assist) rows.push(e("assist", ti, q, opts.assist, { groupId: g }));
  return rows;
};
// A saved shot: shot by the attacker + shot_saved credited to the goalie.
const save = (ti, q, shooter, zone) => {
  const g = grp();
  return [
    e("shot", ti, q, shooter, { groupId: g, zone }),
    e("shot_saved", 1 - ti, q, GOALIES[1 - ti], { groupId: g }),
  ];
};
const faceoff = (winTi, q, winner, loser) => {
  const g = grp();
  return [
    e("faceoff_win", winTi, q, winner, { groupId: g }),
    e("faceoff_loss", 1 - winTi, q, loser, { groupId: g }),
  ];
};
// A caused turnover: turnover on the offense + forced_to for the defender.
const forcedTo = (offTi, q, loser, defender) => {
  const g = grp();
  return [
    e("turnover", offTi, q, loser, { groupId: g }),
    e("forced_to", 1 - offTi, q, defender, { groupId: g }),
  ];
};

export const LOG = [
  // ── Q1 — NDP 2, MAL 1
  ...faceoff(0, 1, ndp.reyes, mal.turner),
  e("ground_ball", 0, 1, ndp.reyes),
  ...goal(0, 1, "10:42", ndp.sullivan, "C1", { assist: ndp.moretti }),
  ...faceoff(1, 1, mal.turner, ndp.reyes),
  ...save(1, 1, mal.cross, "R2"),
  e("ground_ball", 0, 1, ndp.vance),
  e("clear", 0, 1, ndp.walsh),
  ...save(0, 1, ndp.kelly, "C2"),
  ...goal(1, 1, "7:15", mal.cross, "R1"),
  ...faceoff(0, 1, ndp.reyes, mal.turner),
  ...forcedTo(1, 1, mal.webb, ndp.vance),
  e("clear", 0, 1, ndp.barrett),
  ...goal(0, 1, "3:05", ndp.moretti, "L1", { assist: ndp.rowan }),
  ...faceoff(1, 1, mal.turner, ndp.reyes),
  ...save(1, 1, mal.pierce, "C1"),
  e("failed_clear", 1, 1, mal.shaw),

  // ── Q2 — NDP 1, MAL 2 (halftime 3–3)
  ...faceoff(0, 2, ndp.reyes, mal.turner),
  ...forcedTo(0, 2, ndp.dunn, mal.lang),
  e("clear", 1, 2, mal.shaw),
  ...goal(1, 2, "9:58", mal.pierce, "C1", { assist: mal.hartman }),
  e("penalty_min", 0, 2, ndp.barrett, { penaltyTime: "8:12", penaltyMin: 1 }),
  ...goal(1, 2, "7:40", mal.cross, "C1", { emo: true, assist: mal.boland }),
  e("timeout", 0, 2, null, { timeoutTime: "6:55", teamStat: true }),
  ...faceoff(0, 2, ndp.reyes, mal.turner),
  ...save(0, 2, ndp.rowan, "R1"),
  e("ground_ball", 0, 2, ndp.reyes),
  ...goal(0, 2, "4:22", ndp.sullivan, "R2"),
  ...save(1, 2, mal.ott, "L2"),
  e("clear", 0, 2, ndp.walsh),

  // ── Q3 — NDP 3, MAL 1 (NDP 6–4)
  ...faceoff(0, 3, ndp.reyes, mal.turner),
  ...goal(0, 3, "11:02", ndp.kelly, "C2", { assist: ndp.sullivan }),
  ...faceoff(0, 3, ndp.reyes, mal.turner),
  e("ground_ball", 0, 3, ndp.vance),
  ...goal(0, 3, "8:47", ndp.sullivan, "C1", { assist: ndp.moretti }),
  e("timeout", 1, 3, null, { timeoutTime: "8:30", teamStat: true }),
  ...save(1, 3, mal.cross, "L1"),
  ...goal(1, 3, "5:15", mal.webb, "L2"),
  ...faceoff(1, 3, mal.turner, ndp.reyes),
  ...forcedTo(1, 3, mal.pierce, ndp.walsh),
  e("clear", 0, 3, ndp.barrett),
  ...goal(0, 3, "2:33", ndp.rowan, "R1", { assist: ndp.moretti }),
  ...save(1, 3, mal.boland, "C1"),

  // ── Q4 — NDP 2, MAL 2 (final NDP 8, MAL 6)
  ...faceoff(1, 4, mal.turner, ndp.reyes),
  ...goal(1, 4, "9:20", mal.cross, "C1", { assist: mal.boland }),
  ...faceoff(0, 4, ndp.reyes, mal.turner),
  ...goal(0, 4, "6:45", ndp.moretti, "L1"),
  e("penalty_tech", 1, 4, mal.shaw, { penaltyTime: "5:10" }),
  ...goal(0, 4, "4:51", ndp.sullivan, "C1", { emo: true, assist: ndp.kelly }),
  ...faceoff(1, 4, mal.turner, ndp.reyes),
  ...goal(1, 4, "2:05", mal.pierce, "R2", { assist: mal.hartman }),
  ...save(0, 4, ndp.dunn, "C2"),
  e("ground_ball", 1, 4, mal.turner),
  e("failed_clear", 1, 4, mal.lang),
];

export const COMPLETED_QUARTERS = [1, 2, 3, 4];
export const TOTAL_SCORES = [
  LOG.filter((x) => x.event === "goal" && x.teamIdx === 0).length,
  LOG.filter((x) => x.event === "goal" && x.teamIdx === 1).length,
];

// In-progress variant: through halftime, Q2 live.
export const LIVE_LOG = LOG.filter((x) => x.quarter <= 2);
export const LIVE_COMPLETED_QUARTERS = [1];
export const LIVE_QUARTER = 2;

// Derived via the repo's own builders — shape-correct by construction.
export const PLAYER_STATS = buildPlayerStats(LOG);
export const SCORING_TIMELINE = buildScoringTimeline(LOG);
export const LIVE_SCORING_TIMELINE = buildScoringTimeline(LIVE_LOG);

// ── games table rows (state = the denormalized display cache the game list reads) ──
const gameRow = (id, name, state, extra = {}) => ({
  id,
  name,
  org_id: null,
  user_id: "user-fixture-1",
  created_at: "2026-06-20T17:30:00Z",
  pressbox_enabled: true,
  multi_scorer_enabled: false,
  shot_location_enabled: true,
  schema_ver: 2,
  state,
  ...extra,
});

export const GAME_LIVE = gameRow("game-live-1", "NDP vs Malvern Prep", {
  teams: TEAMS,
  trackingStarted: true,
  gameOver: false,
  currentQuarter: 3,
  score0: 6,
  score1: 4,
  gameDate: "2026-06-20",
  log: [{ quarter: 3, event: "goal", teamIdx: 0, goalTime: "8:47" }],
});

export const GAME_FINAL = gameRow("game-final-1", "NDP vs Malvern Prep", {
  teams: TEAMS,
  trackingStarted: true,
  gameOver: true,
  currentQuarter: 4,
  score0: 8,
  score1: 6,
  gameDate: "2026-06-13",
});

export const GAME_PENDING = gameRow("game-pending-1", "NDP vs Haverford School", null, {
  created_at: "2026-06-28T15:00:00Z",
});

// ── admin fixtures ──
export const ADMIN_USERS = [
  { id: "user-fixture-1", email: "coach@ndprep.org" },
  { id: "user-2", email: "scorekeeper@ndprep.org" },
  { id: "user-3", email: "athletics@malvernprep.org" },
];
export const ADMIN_USER_MAP = Object.fromEntries(ADMIN_USERS.map((u) => [u.id, u]));

export const ADMIN_ORG = {
  id: "org-ndp",
  name: "Notre Dame Prep",
  slug: "notre-dame-prep",
  plan: "pro",
  plan_status: "active",
  color: "#1a6bab",
  logo_url: null,
  member_count: 6,
  team_count: 4,
  season_count: 2,
  game_count: 38,
};

// ── personal usage meter ──
export const USAGE = { current_count: 7, game_limit: 10, at_limit: false };
export const USAGE_AT_LIMIT = { current_count: 10, game_limit: 10, at_limit: true };
