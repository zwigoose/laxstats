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

// Design tokens — colors (C), font stacks (F), shadows (SH).
export { C, F, SH } from "../src/styles/tokens.js";

// Ordered stat-column list PlayerStatsTable expects via its statKeys prop.
export { PLAYER_STAT_KEYS } from "../src/components/PlayerStatsTable.jsx";
