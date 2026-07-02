// Curated design-sync bundle entry for LaxStats.
//
// The repo is an app, not a packaged library — there is no dist/ barrel to
// bundle. This entry exports exactly the components scoped for Claude Design.
// SharePanel and the LaxStats scorekeeper are deliberately absent: both import
// the Supabase client, which throws at module init outside the app (no
// VITE_* env). Keep this list in step with componentSrcMap in config.json.
export { default as GameLiveStream } from "../src/components/GameLiveStream.jsx";
export { default as GameTimeline } from "../src/components/GameTimeline.jsx";
export { default as HeroCard } from "../src/components/HeroCard.jsx";
export { default as PlayerStatsTable } from "../src/components/PlayerStatsTable.jsx";
export { default as RosterEditor } from "../src/components/RosterEditor.jsx";
export { default as ShotMap } from "../src/components/ShotMap.jsx";
export { default as MomentumTracker } from "../src/components/analytics/MomentumTracker.jsx";
export { default as FieldMapInput } from "../src/components/LaxStats/FieldMapInput.jsx";
export { default as NumberKeypad } from "../src/components/LaxStats/NumberKeypad.jsx";
export { default as TimeKeypad } from "../src/components/LaxStats/TimeKeypad.jsx";

// App chrome + views (round 2 — require DesignPreviewShell for router/auth
// context; the hardened supabase client makes their module init safe).
export { default as AppNav } from "../src/components/AppNav.jsx";
export { default as Login } from "../src/pages/Login.jsx";
export { default as Guide } from "../src/pages/Guide.jsx";
export { default as Pricing } from "../src/pages/Pricing.jsx";
export { default as Profile } from "../src/pages/Profile.jsx";
export { default as GameList, GameCard, LiveCard, PersonalUsageMeter } from "../src/pages/GameList.jsx";
export { default as SharePanel } from "../src/components/SharePanel.jsx";

// Admin suite.
export { default as Admin } from "../src/pages/Admin/index.jsx";
export { default as AllGamesTab } from "../src/pages/Admin/AllGamesTab.jsx";
export { default as OrgsTab } from "../src/pages/Admin/OrgsTab.jsx";
export { default as PlanLimitsTab } from "../src/pages/Admin/PlanLimitsTab.jsx";
export { default as RostersAdminTab } from "../src/pages/Admin/RostersAdminTab.jsx";
export { default as UsersTab } from "../src/pages/Admin/UsersTab.jsx";
export { default as OrgCard } from "../src/pages/Admin/OrgCard.jsx";
export { default as AdminGameRow } from "../src/pages/Admin/AdminGameRow.jsx";
export { default as AdminSharePanel } from "../src/pages/Admin/AdminSharePanel.jsx";
export { default as OwnerSelect } from "../src/pages/Admin/OwnerSelect.jsx";
export { default as SectionToggle } from "../src/pages/Admin/SectionToggle.jsx";
export { default as OrgGameGroup } from "../src/pages/Admin/OrgGameGroup.jsx";

// Router/auth context shell for previews and designs that host the views above.
export { default as DesignPreviewShell } from "./preview-shell.jsx";

// Design tokens — colors (C), font stacks (F), shadows (SH).
export { C, F, SH } from "../src/styles/tokens.js";

// Ordered stat-column list PlayerStatsTable expects via its statKeys prop.
export { PLAYER_STAT_KEYS } from "../src/components/PlayerStatsTable.jsx";
