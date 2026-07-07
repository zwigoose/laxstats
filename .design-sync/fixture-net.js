// Fixture network for out-of-app rendering.
//
// The hardened supabase client points at https://placeholder.invalid when no
// env is present — every request to it is a guaranteed DNS failure that
// surfaces as "TypeError: Failed to fetch" banners in fetch-on-mount
// components. This module wraps window.fetch and answers ONLY requests to
// that placeholder host with fixture JSON, so components run their real data
// paths and render real content. All other URLs pass through untouched; app
// builds carry real env vars and never produce placeholder requests, so this
// can never affect the app.
import {
  GAME_LIVE, GAME_FINAL, GAME_PENDING, TEAMS, ADMIN_USERS, ADMIN_ORG, USAGE,
} from "./previews/_fixtures";

// An org-linked game for the org-games sections (PostgREST-embed shape).
const ORG_TEAMS = [
  { id: "team-ndp-v", name: TEAMS[0].name, color: TEAMS[0].color, logo_url: null },
  { id: "team-mal-v", name: TEAMS[1].name, color: TEAMS[1].color, logo_url: null },
];
const ORG_GAME = {
  ...GAME_FINAL,
  id: "game-org-1",
  org_id: ADMIN_ORG.id,
  game_date: "2026-06-13",
  home_team: ORG_TEAMS[0],
  away_team: ORG_TEAMS[1],
  org: { id: ADMIN_ORG.id, name: ADMIN_ORG.name, slug: ADMIN_ORG.slug },
};
const GAMES = [GAME_LIVE, GAME_FINAL, GAME_PENDING].map((g) => ({
  ...g,
  org: null,
}));

const SAVED_TEAMS = [
  { id: "roster-1", name: TEAMS[0].name, roster: TEAMS[0].roster, color: TEAMS[0].color, user_id: ADMIN_USERS[0].id, logo_url: null },
  { id: "roster-2", name: TEAMS[1].name, roster: TEAMS[1].roster, color: TEAMS[1].color, user_id: ADMIN_USERS[2].id, logo_url: null },
];

// game_id/team_idx/goals rows backing the score overlays on game lists.
const TEAM_TOTALS = [
  { game_id: GAME_LIVE.id, team_idx: 0, goals: 6 },
  { game_id: GAME_LIVE.id, team_idx: 1, goals: 4 },
  { game_id: GAME_FINAL.id, team_idx: 0, goals: 8 },
  { game_id: GAME_FINAL.id, team_idx: 1, goals: 6 },
  { game_id: ORG_GAME.id, team_idx: 0, goals: 8 },
  { game_id: ORG_GAME.id, team_idx: 1, goals: 6 },
];

const PLAN_FEATURES = [
  { id: "active_seasons", feature_id: "active_seasons", description: "Active seasons", pro_limit: 2, max_limit: null },
  { id: "active_teams", feature_id: "active_teams", description: "Active teams", pro_limit: 8, max_limit: null },
  { id: "members", feature_id: "members", description: "Members", pro_limit: 15, max_limit: null },
  { id: "games_per_season", feature_id: "games_per_season", description: "Games per season", pro_limit: null, max_limit: null },
  { id: "bonus_personal_games", feature_id: "bonus_personal_games", description: "Bonus personal games / member", pro_limit: 5, max_limit: 15 },
];
const PERSONAL_PLAN_LIMITS = [
  { plan: "free", game_limit: 3 },
  { plan: "basic", game_limit: 10 },
  { plan: "plus", game_limit: 25 },
];

const RPC = {
  admin_get_users: () => ADMIN_USERS.map((u, i) => ({
    ...u,
    is_admin: i === 0,
    personal_plan: ["pro", "free", "basic"][i] ?? "free",
    personal_plan_status: "active",
  })),
  admin_get_orgs: () => [ADMIN_ORG],
  admin_get_all_rosters: () => SAVED_TEAMS.map((t) => ({ ...t, owner_name: ADMIN_USERS.find((u) => u.id === t.user_id)?.email })),
  admin_get_plan_features: () => PLAN_FEATURES,
  admin_get_personal_plan_limits: () => PERSONAL_PLAN_LIMITS,
  admin_get_org_members: () => ADMIN_USERS.map((u, i) => ({ user_id: u.id, email: u.email, role: i === 0 ? "org_admin" : "scorekeeper" })),
  admin_get_org_features: () => [],
  get_roster_shares: () => [{ share_id: "share-1", shared_with_user_id: ADMIN_USERS[1].id, display_name: "scorekeeper@ndprep.org" }],
  find_user_by_username: () => [{ user_id: ADMIN_USERS[1].id, display_name: "scorekeeper@ndprep.org" }],
  personal_game_usage: () => USAGE,
  org_feature_limit: () => null,
};

const TABLES = {
  // Which slice of games a query wants, inferred from its select/filters:
  // org-embedded selects (home_team join or org_id filter) get the org game;
  // selects embedding organizations get both; plain selects get personal games.
  games: (u) => {
    const q = u.searchParams.toString();
    if (q.includes("home_team") || String(u.searchParams.get("org_id") ?? "").includes("in.")) return [ORG_GAME];
    if (q.includes("organizations")) return [...GAMES, ORG_GAME];
    return GAMES;
  },
  v_game_team_totals: () => TEAM_TOTALS,
  saved_teams: () => SAVED_TEAMS,
  seasons: () => [{ id: "season-1", name: "Spring 2026" }],
  organizations: () => [ADMIN_ORG],
  teams: () => ORG_TEAMS,
  plan_features: () => PLAN_FEATURES,
  personal_plan_limits: () => PERSONAL_PLAN_LIMITS,
  roster_shares: () => [],
  profiles: () => [{ id: ADMIN_USERS[0].id, is_admin: true, personal_plan: "pro", personal_plan_status: "active", display_name: "Coach Ferrari" }],
  org_members: () => [],
};

function jsonResponse(body, single) {
  const payload = single && Array.isArray(body) ? (body[0] ?? null) : body;
  const n = Array.isArray(body) ? body.length : 1;
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-range": `0-${Math.max(0, n - 1)}/${n}`,
    },
  });
}

function fixtureResponse(url, init) {
  const u = new URL(url);
  const headers = new Headers(init?.headers ?? {});
  const single = (headers.get("accept") ?? "").includes("vnd.pgrst.object");
  const method = (init?.method ?? "GET").toUpperCase();

  const rpcMatch = u.pathname.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/i);
  if (rpcMatch) {
    const fn = RPC[rpcMatch[1]];
    // Unknown RPCs (all the admin_set_*/delete_* writes) succeed as no-ops.
    return jsonResponse(fn ? fn(u) : null, false);
  }
  const tableMatch = u.pathname.match(/\/rest\/v1\/([a-z0-9_]+)/i);
  if (tableMatch) {
    if (method !== "GET" && method !== "HEAD") return jsonResponse([], false);
    const rows = TABLES[tableMatch[1]];
    return jsonResponse(rows ? rows(u) : [], single);
  }
  // auth/storage/anything else: succeed quietly.
  return jsonResponse({}, false);
}

// Install once, pass everything except the placeholder host through.
if (typeof window !== "undefined" && !window.__dsFixtureNet) {
  window.__dsFixtureNet = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    if (!url.includes("placeholder.invalid")) return realFetch(input, init);
    try {
      return Promise.resolve(fixtureResponse(url, init));
    } catch {
      return realFetch(input, init);
    }
  };
}
