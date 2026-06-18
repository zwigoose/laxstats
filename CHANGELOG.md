# Changelog

All notable changes to LaxStats are documented here.
Versioning follows [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`.

---

## [2.21.4] — 2026-06-17

### Changed
- **Guide / user guide** — clarified the save % stat definitions so the per-goalie **Sv%** ("Goalie save %") is clearly distinct from the team aggregate, now labeled **"Team save %"**

---

## [2.21.3] — 2026-06-17

### Fixed
- **MOMENTUM graph** — the line no longer runs backward ("goes back in time") when a play was entered into an earlier quarter late or after a quarter override; the series is now built in game-time order so the x-axis stays monotonic

### Added
- **MOMENTUM graph** — tap-and-drag scrubbing on touch devices, matching the existing mouse hover

---

## [2.21.2] — 2026-06-11

### Changed
- **Guide page** — added a screenshot of the MOMENTUM graph from a completed game below the MOMENTUM card

---

## [2.21.1] — 2026-06-11

### Changed
- **MOMENTUM branding** — the momentum tracker is now presented as MOMENTUM, LaxStats' live view of game control; the chart header gains an ⓘ tooltip with a quick explanation, and the Guide page and user guide document how the line works

---

## [2.21.0] — 2026-06-11

### Added
- **Momentum tracker** — the game view (`/view`) now shows a live line graph below the score visualizing which team is controlling the game; goals, shots, faceoff wins, clears, caused turnovers, and penalties (credited to the man-up team) push the line toward that team's side, momentum decays toward neutral during quiet stretches, and hovering a point reveals the event behind it; computed entirely client-side from the existing event log (no schema change), updating in real time

---

## [2.20.0] — 2026-06-11

### Added
- **Goalie and faceoff records in season & org stats** — goals allowed and faceoff losses now roll up through the season and all-time stat views; season Stat Leaders and org All-Time Leaders add **Faceoff %** and **Goalie Save %** leaderboards (minimum 10 attempts to qualify, so tiny samples can't top a percentage list)

---

## [2.19.0] — 2026-06-11

### Added
- **Active goalies** — per-team 🧤 GK chips at the top of the scorekeeper Track screen set each team's goalie in net; the choice persists with the game, syncs live to viewers, and can be changed mid-game as the substitution mechanism (a Goalie Change marker appears in the event log); a one-time reminder appears after the first event if either goalie is unset; the current goalies show near the team names on Live View and Press Box
- **Automatic save attribution** — with the defending team's active goalie set, Shot → Saved commits immediately with no goalie-grid step; editing the entry still offers the full grid as the correction path
- **Goals Allowed (GA)** — every goal records a GA against the goalie in net at entry time (in the same entry group, never retroactive); new GA and per-goalie Sv% columns in player stat tables on the scorekeeper, Live View, Press Box, and print report; legacy games show GA as zero, never inferred
- **Smarter finalization goalie pre-selection** — the wizard pre-selects the most-saves goalie for the win and the highest-GA goalie for the loss (ties fall back to the active goalie), still fully overridable

### Fixed
- **Print report FO% column** — rendered blank cells for players with recorded stats

---

## [2.18.0] — 2026-06-10

### Added
- **New turnover flow** — turnovers are entered as a chain: the player who committed it, who caused it on the opposing team (skippable when unforced), and an optional ground ball for the opposing team; all entries share one group so deleting removes the whole chain
- **New clear flow** — a single Clear event with a Successful/Failed result prompt; failed clears can chain directly into the turnover flow as one grouped action
- **New faceoff flow** — started from its own button on the team select screen; captures both faceoff players, then the winner, then the existing ground-ball follow-up; records paired faceoff win/loss entries so per-player FO W-L records and FO% build automatically (legacy games show wins only)
- **Add a missing jersey number mid-flow** — every player grid has a ＋ # dialpad tile that adds the number to the roster and immediately selects it for the in-flight entry; duplicates are rejected
- **Game finalization wizard** — ending Q4 with a winner (or a sudden-death OT goal) opens a review before anything is committed: roster corrections for players added/edited during the game (with optional propagation to the org roster), winning and losing goalie decisions (shown as W/L in player stats), and an explicit final summary; "Not yet — keep scoring" escape at every step
- **Combine players merge tool** — org team management can merge two roster entries that are the same player (jersey change or in-game placeholder); a transactional RPC rewrites historical game events and box scores to the chosen final number/name
- **Six-zone shot map** — shot location is now captured by tapping one of six field zones (left/center/right × close/far); shot maps display per-zone shots-goals and shooting % with volume-scaled shading; the area behind the goal line is not a valid shot origin; legacy x/y points are bucketed into zones automatically

### Removed
- **Blocked shot tracking** — the Blocked outcome, Blk stat, and all blocked-shot displays are gone; historical blocked-shot rows are deleted and legacy games load cleanly
- **Standalone Caused TO and Faceoff W events** — both are now recorded through the new turnover and faceoff flows; the caused-TO stat itself is unchanged

### Fixed
- **Follow status on game view** — the Follow button no longer shows "Following" for games this browser never followed, and unfollowing one game no longer breaks push notifications for other followed games; duplicate follow rows (duplicate notifications) can no longer accumulate
- **Shot map double-counting** — a scored goal counted as two shots in its zone (its paired shot + goal entries); zone aggregates now count one attempt per entry group
- **Header layout shift on mobile** — the scorekeeper and game view headers no longer change height (shifting the whole UI) when the "Saving…" status appears; long game names truncate with an ellipsis instead of wrapping

---

## [2.17.1] — 2026-06-10

### Security
- **RLS enabled on `personal_plan_limits`** — table previously had no row-level security, which meant any visitor with the anon key (shipped in the client bundle) could `UPDATE` plan caps and bypass billing enforcement; reads stay public, writes now flow only through the existing `admin_set_personal_plan_limit()` RPC

### Removed
- **v1 game migration tooling** — the v1 → v2 migration was retired in v2.12.0; dropped the `migration_errors` log table, the Migration admin tab, and the `migrate_v1_games` edge function

---

## [2.17.0] — 2026-06-05

### Added
- **Guide page** — new `/guide` page (linked from the top nav) covering all major features: personal vs org game comparison, scorekeeper setup and tracking flow, all event types, quarters and overtime, editing entries, stats views, Live View, Press Box, multi-user scoring, saved rosters, organizations, plans, and full stat definitions; includes 18 in-app screenshots

---

## [2.16.0] — 2026-06-04

### Added
- **Print / PDF export** — completed games now have an "Export ↗" button on the `/view` page that opens a print-optimised report at `/games/:id/print`; the report includes the final score with team logos, quarter-by-quarter scoring grid, full team stats (scoring, defense, shooting, possession, clearing, penalties), and per-team player stat tables; clicking "Print / Save as PDF" in the browser produces a clean multi-page PDF

---

## [2.15.0] — 2026-06-02

### Added
- **Team and game logos** — org teams, saved rosters, and individual games can now each carry a logo image; logos are uploaded to Supabase Storage (`org-logos` for org/team logos, `game-logos` for saved-roster and per-game overrides) and cascade through setup: org team logo → saved roster logo → per-game upload, with each level able to override the previous
- **Logos shown throughout the app** — logos appear on game cards (home page, org games list), the live/final score header on the game view page, the Pressbox score banner, and the shareable Hero Card PNG
- **Admin logo management** — platform admins can upload, change, or remove logos for any saved roster and any org directly from `/admin`

### Removed
- **JSON game import** — the "Import JSON" panel in the scorekeeper has been removed; the "Export JSON" option is retained for data extraction

---

## [2.14.0] — 2026-06-01

### Added
- **Hero Card** — a "Hero Card" button appears in the game header once a game is marked Final; clicking opens a modal with a dark 1080×1080-style graphic showing the final score with team colors, winner callout, and auto-selected Player of the Game (highest G+A); one-click PNG download via `html-to-image`
- **Live event feed** — a **Feed** tab on the game view page shows a fan-oriented goal-by-goal stream with running score, quarter separators (Live/Final), and key non-goal events; updates in real time via existing Supabase Realtime subscription
- **Follow game / push notifications** — a **Follow** button appears in the game header on live games; clicking requests browser notification permission, registers a Web Push subscription via service worker, and stores it in the new `game_subscriptions` table; a `notify-goal` Supabase Edge Function fans out push notifications to all followers when a goal is scored; stale subscriptions (410 responses) are pruned automatically

---

## [2.13.0] — 2026-06-01

### Added
- **Shot location tracking** — when enabled on a game by a platform admin, the scorekeeper is prompted to tap the shot location on a field map after each shot or goal; coordinates are stored as normalized floats (`shot_x`, `shot_y`) on `game_events`
- **Shot map view** — a **Map** tab in the scorekeeper Stats screen shows all recorded shot locations plotted on a half-field diagram, mirroring the existing map on `/view`; both support a team filter (Both / Home / Away)
- **Faceoff ground ball sub-item** — when a faceoff win has an attributed ground ball, the GB appears as a sub-item chip in the event log alongside assists, saves, and goal time — consistent with the existing goal detail pattern

### Changed
- **Stat columns unified** — `/score`, `/view`, and `/pressbox` player tables now show identical columns in the same order: G, A, Sh, SOG, Sv, Blk, GB, FW, TO, CTO, Tech, PF Min; previously the full and pressbox tables differed by two columns (EMO, Blk)
- **Shot map field graphic** — redrawn as a true half-field (midline to end line, full width); restraining line at 20 yd from midfield, vertical wing lines from restraining to end line, goal triangle with crease, correct proportions throughout

### Fixed
- **Event log not updating live** — newly committed entries were sorted to position 0 (missing DB `seq`) and appeared at the bottom of the reversed log, off-screen on mobile; fallback changed from `0` to `Number.MAX_SAFE_INTEGER` so unsaved entries sort last and appear at the top of the display immediately after being logged
- **Player stats table header and first column now frozen** — added `position: sticky` to `<thead>` cells (`top: 0`) and the Player name column (`left: 0`); wrapper given `overflow: auto` + `max-height` so both sticky axes work correctly as a 2D scroll container

---

## [2.12.0] — 2026-05-21

### Added
- **Mid-game per-player roster editor** — after tracking starts, the Setup tab replaces the raw roster textarea with a structured per-player list; each player can be edited inline (number change, name correction) and walk-on players can be added at any time via **+ Add player**; duplicate-number validation runs on save; org-linked rosters show a "game-day edits only" badge and changes never modify the permanent Org → Teams roster
- **`game_meta_events` for authoritative quarter state** — quarter-start, quarter-end, and game-over transitions are now written as immutable rows in `game_meta_events`; `deriveQuarterState()` replays these rows on every load so quarter and game-over state is never lost across page refreshes, scorer hand-offs, or reconnects; broadcast hints are used as a fast-path with DB rows as ground truth

### Changed
- **Unified data model** — all games (personal and org-linked) now use `game_events` + `game_meta_events` for event storage; the v1/v2 architecture split based on `org_id` has been removed; `games.state` is retained only as a denormalized display cache (`gameOver`, `currentQuarter`, `score0`, `score1`) for the game list
- **Live view and Pressbox update without refresh** — `/view` and `/pressbox` subscribe to the same `game-events-{id}` broadcast channel as the scorekeeper, receiving new events, deletions, and quarter changes instantly; postgres_changes are kept as a fallback for late-joiners
- **Pressbox event log sorted newest-first** — events now appear sorted by insertion sequence (most recently scored at top) rather than by game clock time
- **gameOver and score reflected on homepage immediately** — finalizing a game now correctly persists `gameOver`, `currentQuarter`, `score0`, and `score1` to `games.state`, so the game list shows "Final" status and the correct score without a refresh

### Fixed
- **Roster cleared on scorekeeper reconnect** — the scorekeeper roster was silently wiped when the realtime channel reconnected mid-game: `useGameEvents` called `load()` again which set `eventsLoading = true`, unmounting LaxStats and rehydrating from the stale initial `game.state` (captured before team setup was saved); LaxStats is now kept mounted after the first successful load
- **`parsedRosters` frozen at game start** — mid-game roster edits via the old free-form textarea were ignored by the player picker because `parsedRosters` was only populated at `handleStart()` time; the new roster editor atomically updates both the persisted roster string and the live player-picker array

### Database
- `game_meta_events`: new table for quarter/game-over transition events with `REPLICA IDENTITY FULL` and added to the `supabase_realtime` publication

---

## [2.11.0] — 2026-05-19

### Added
- **QR code on Live View** — a **QR** button on `/games/:id/view` opens a modal with a scannable QR code for the game URL; tap **Save image** to download as PNG; replaces the invite-scorer link panel on that page
- **Branded confirmation and password-reset emails** — LaxStats-styled HTML templates (blue wordmark, card layout, CTA button) replace the default Supabase emails for signup confirmation and password reset; templates versioned in `supabase/templates/`
- **Subscription period tracking** — `cancel_at_period_end` and `current_period_end` columns added to `organizations` and `profiles`; the Stripe webhook now stamps both fields on every subscription event so the app knows when a billing period ends and whether a cancellation is scheduled
- **Org plan status banners** — org admins see a contextual banner at the top of the org dashboard: yellow "Cancels on [date]" when cancellation is pending, red "Payment past due" with a billing link, or red "Subscription expired" with a renew link when the org is locked
- **Post-checkout polling on Profile** — `/profile?checkout=success` now polls `refreshProfile` every 2 s (up to 30 s) until the webhook updates `personal_plan`, matching the existing behaviour on `/orgs`

### Changed
- **New-org flow unblocked for canceled admin orgs** — users whose only admin orgs are in `canceled` status now see the new-org creation form on `/pricing` instead of being stuck in an upgrade-only flow; they can re-subscribe to the old org via the dashboard "Renew →" link or start a brand-new org
- **Post-checkout redirect fires immediately** — the Orgs page no longer polls for the full 30 s when the webhook processed before the page loaded; it redirects as soon as auth settles, choosing the most recently joined org by `created_at`

### Infrastructure
- Stripe test-mode keys and webhook endpoint wired to the staging Supabase project; `SITE_URL` set correctly so checkout redirects land on `staging.laxstats.app`
- `stripe-webhook` Edge Function redeployed with `--no-verify-jwt` so Stripe can POST without a bearer token (security is handled by webhook signature verification inside the function)
- `create_at` added to `org_members` select in `AuthContext` to support newest-org detection

### Database
- `organizations`: added `cancel_at_period_end BOOLEAN NOT NULL DEFAULT false`, `current_period_end TIMESTAMPTZ`
- `profiles`: added `cancel_at_period_end BOOLEAN NOT NULL DEFAULT false`, `current_period_end TIMESTAMPTZ`

---

## [2.10.2] — 2026-05-08

### Fixed
- **Player delete cascades correctly** — deleting a player from the org now also removes their `team_season_roster` entries; previously failed with a FK constraint 409 error
- **Personal game cap banner shown for unlimited users** — the banner now renders even when `game_limit` is null (giga org members, admins), displaying `X / ∞` without a progress bar

### Database
- `team_season_roster.player_id`: added `ON DELETE CASCADE`
- `personal_game_limit()`: giga org bonus (NULL) correctly yields unlimited combined cap; `personal_game_usage()` always returns a row so the UI can render the banner

---

## [2.10.1] — 2026-05-08

_Intermediate hotfix — superseded by 2.10.2._

---

## [2.10.0] — 2026-05-08

### Added
- **Season roster management** — players are now independent org-level entities reusable across teams; `team_season_roster` stores per-season, per-team rosters with optional jersey overrides; OrgDashboard seasons tab shows a collapsible roster panel per team with add/remove/jersey-edit UI; player cards show season history grouped by season
- **"Add existing player" to team** — TeamManager now lets coaches add a player already in the org's pool to any team with a separate jersey number, without duplicating the player record
- **Pricing page** (`/pricing`) rewritten — personal plans (Free $0, Basic $5/mo, Plus $10/mo) and org plans (Pro $10/mo, Max $20/mo) shown with live limits pulled from `plan_features` and `personal_plan_limits` tables; cumulative personal game cap explained with a live example; no hardcoded values
- **Cross-org scoring** — away org members with `org_admin`, `coach`, or `scorekeeper` roles can access the scorekeeper view for cross-org games directly, without needing an invite token
- **Multi-scorer auto-enabled by plan** — `create_org_game` now automatically sets `multi_scorer_enabled=true` for Max org games based on the `multi_scorekeeper` plan feature; Pro orgs get `false`

### Changed
- **Free org tier removed** — existing free orgs migrated to Pro; `organizations.plan` CHECK constraint updated; all UI references updated
- **Personal game cap is additive** — `personal_game_limit()` now returns `personal_plan_limit + org_member_personal_games_bonus` (was `GREATEST`); `org_member_personal_games` limits set to pro=10, max=20
- **Pro orgs have no multi-scorekeeper** — `plan_features.multi_scorekeeper` pro_limit set to 0; Pro org games get `multi_scorer_enabled=false`; "Invite scorer" button remains gated on `multi_scorer_enabled`
- **Personal plans exclude Press Box** — Press Box is an org-only feature; removed from personal plan descriptions on Pricing page

### Database
- `team_season_roster`: RLS enabled; public SELECT + coach/admin write policies added
- New RPCs: `get_season_team_roster`, `upsert_season_roster_player`, `remove_season_roster_player`
- `plan_features`: `GRANT SELECT TO anon, authenticated` (required for public Pricing page reads)
- `personal_plan_limits`: seeded (free=3, basic=10, plus=20)
- `create_org_game`: auto-sets `multi_scorer_enabled` from `org_feature_limit(p_org_id, 'multi_scorekeeper')`
- `can_score_game()`: away org members with scoring roles can score cross-org games
- `create_scorekeeper_invite`: remains gated on `multi_scorer_enabled` (Max org only)

---

## [2.9.0] — 2026-05-07

### Added
- **Entitlement system** — org plans (free/pro/max/giga) now enforce limits on active seasons, active teams, members, and games per season; enforcement RPCs (`create_org_season`, `create_org_team`, `create_org_game`, `invite_org_member`) raise structured errors (`plan_limit_exceeded:feature:current:limit`) translated to readable messages in the UI
- **Personal plans** — profiles now carry a `personal_plan` field (free/basic/plus) with status; displayed on the Profile page alongside the org plan badge
- **Usage meters** — the Seasons, Teams, and Members tabs in OrgDashboard show live usage counts vs. plan limits; action buttons disable at limit with an "Upgrade →" link
- **Pricing page** (`/pricing`) — plan comparison table (Pro $49/mo, Max $149/mo, Giga/Custom) with feature grid; CTA stubs with contact email (no live billing)
- **Admin personal plan management** — platform admins can set any user's personal plan and status from the Users tab in Admin
- **Org all-time stat leaders** — new "Stats" tab on OrgDashboard aggregates player stats across all seasons via `v_org_player_stats` view; shows top-5 per category (goals, assists, points, SOG, ground balls, faceoff wins, saves)
- **Season standings table** — SeasonView now shows a standings table (W, L, GF, GA, +/-) aggregated from `v_season_team_stats` for all teams that played in the season

### Changed
- **Plan names** — org plan tiers renamed: `starter` → `pro`, `enterprise` → `giga`; `pro` → `max`; `plan_features` table reseeded with new limits
- **One-org-per-user invariant** — `org_members` now has `UNIQUE(user_id)`; `admin_add_org_member` removes a user from any existing org before adding to the new one
- **`AuthContext`** — now exposes `profile` (including `personal_plan`, `personal_plan_status`) in context value; org memberships include org plan
- **`entitlementMsg` utility** (`src/utils/entitlement.js`) — shared translation from raw RPC error strings to human-readable messages, used across OrgDashboard, TeamManager, and CreateGame
- **`useOrgEntitlements` hook** (`src/hooks/useOrgEntitlements.js`) — shared hook that loads `org_entitlement_summary` once per org and returns a feature-keyed map

### Database
- `profiles`: added `personal_plan`, `personal_plan_status` columns
- `seasons`: added `status` column (active/archived)
- `teams`: added `status` column (active/retired)
- New view `v_org_player_stats`: aggregates `v_season_player_stats` across all seasons per org
- New RPCs: `org_feature_enabled`, `org_entitlement_summary`, `create_org_season`, `create_org_team`, `create_org_game`, `admin_set_personal_plan`
- Updated RPCs: `invite_org_member` (one-org check), `admin_add_org_member` (removes from other orgs), `admin_get_users` (includes personal plan)

---

## [2.8.0] — 2026-05-06

### Added
- **Dynamic browser tab titles** — each page sets a contextual `document.title` via a shared `useDocTitle` hook; game views show "Team A vs Team B", org pages show the org name, season pages show "Season · Org", etc.; staging tabs are prefixed with "Staging LaxStats"

### Fixed
- **MDD/EMO not credited when penalty expires at a quarter boundary** — `buildTeamTotals` now accepts `completedQuarters` and injects quarter-end absolute times into the timed-event set used to detect whether a penalty window has expired; previously, if no timed event was logged after the penalty expired (e.g. the quarter simply ended), neither team received MDD success or EMO failure credit
- **Pressbox scoring timeline out of order** — timeline events were rendered in log-insertion order instead of being sorted by quarter then time remaining; a Q3 goal would appear at the end of the list regardless of when it occurred
- **Pressbox event log in wrong order** — the event log was rendering in chronological order (oldest first) instead of reverse-chronological (newest first) after the `buildLogGroups` refactor

### Changed
- **`buildLogGroups` and `buildScoringTimeline` extracted as shared utilities** (`src/utils/stats.js`) — eliminates three separate inline implementations of group sorting and timeline construction across `LaxStats`, `ViewGame`, and `Pressbox`; all use the same sort (quarter asc, time remaining desc, seq fallback via `groupPrimary`)
- **v1 game code paths removed** — all games have been migrated to v2 (`schema_ver=2`); `ScorekeeperV1` deleted, `isV2` branching removed from `ViewGame` and `Pressbox`, score lookups in `GameList`/`OrgDashboard`/`SeasonView`/`Orgs` now unconditionally read from `v_game_team_totals`

---

## [2.7.0] — 2026-05-05

### Changed
- **Season stat leaders filtered to org's own players** — in cross-org games, only players whose team belongs to the season's org appear in stat leaders; opponents are excluded
- **Standings removed from season view** — since games are always between different orgs (programs), a standings table within a season is not meaningful; the section has been removed

---

## [2.6.0] — 2026-05-05

### Added
- **Dupe warning banner on Track screen** — when duplicate events are detected, a tappable amber banner appears at the top of the Track screen; tapping navigates directly to the Dupes tab in the Event Log
- **"Delay of Game" penalty** — added as a technical foul option in the penalty selection flow

### Fixed
- **0-0 score for v2 games in `/orgs` and season pages** — recent games on the Orgs dashboard and games list in SeasonView now fetch goal counts from `v_game_team_totals` for v2 games instead of reading the (null) `state.log`
- **End-quarter modal reappears after confirming** — `resetEntry()` was never called when `onMetaEvent()` returned `undefined` (causing `.catch()` to throw); moved `resetEntry()` before the meta broadcast in both quarter-end paths so the modal always dismisses
- **Stayed on Stats tab after ending a non-final quarter** — after confirming end of a non-final quarter, the scorekeeper now stays on the Track screen instead of being redirected to Stats
- **"Last known" player button layout shift on time entry** — the faceoff winner and goalie featured buttons now render inside the player grid (full-width, two rows tall) so the numpad position is stable whether or not a featured player is present
- **TimeKeypad layout shift from "Same as latest" button** — wrapped the button in a fixed-height container so the numpad doesn't shift when the button appears or disappears
- **Event log out of chronological order** — the Event Log tab now sorts groups by quarter ascending, then time remaining descending, then insertion order; events entered out of sequence appear at their correct game-time position

---

## [2.5.0] — 2026-05-05

### Added
- **Cross-org games** — a game can now involve teams from two separate LaxStats orgs (e.g. Rockville High vs. Riverfalls Prep); the creating org searches for the opponent by school name during game creation and links them via `away_org_id`; both orgs' teams are available in both the home and away slots of the scorekeeper setup screen so neither org is assumed to be the home team
- **Away org season attribution** — when an away org member views a cross-org game, an admin sees an "Add to season" banner that lets them attribute the game to one of their own seasons via the `link_game_to_away_season` RPC; the game then appears in both orgs' season records independently
- **Away org scoring access** — scorekeepers, coaches, and admins from the away org can score the game; both `can_score_game()` and the `gevents_insert_scorekeeper` RLS policy now check membership in `away_org_id` in addition to `org_id`

### Changed
- `games` table: new `away_season_id` column (FK → seasons) for away org season linkage

---

## [2.4.0] — 2026-05-04

### Added
- **`PlayerStatsTable` component** (`src/components/PlayerStatsTable.jsx`) — shared player stats table used by `/score`, `/view`, and `/pressbox`; owns its own sort state; merges full roster so all players are shown even with zero stats; sortable by jersey number (default), name, or any stat column; `compact` mode for the Pressbox panel; exports `PLAYER_STAT_KEYS` (full column set) and `PRESSBOX_STAT_KEYS` (condensed) for callers to import
- **Goal count in timeline** — goal rows in the scoring timeline (both `/view` and `/pressbox`) now show a player's cumulative goal count in parentheses after their name starting from their second goal (e.g. `#12 Firstname Lastname (3)`)

### Changed
- **Standardized player stats tables** — `/score` Stats > Players, `/view` Stats > Players, and `/pressbox` Player Stats panel all now use `PlayerStatsTable`; sort by `#` / Name controls are consistent across all three; all roster players are shown regardless of whether they have logged any events
- **Duplicate review: SECURITY DEFINER RPC** — `dismiss_duplicate_flag()` RPC now bypasses `created_by` RLS so any scorer on a game can clear the duplicate flag on any event, not just their own; `dismissDuplicateFlag` service updated to call `db.rpc()` instead of a direct table UPDATE
- **Duplicate review: inline delete confirmation** — the Delete button in the Dupes tab now shows inline Confirm/Cancel buttons instead of navigating away to the track screen

---

## [2.3.0] — 2026-05-04

### Added
- **Offline scoring** (PR #16) — scorekeepers can now log events without an internet connection; events are queued in IndexedDB via `src/services/offlineQueue.js` and replayed to the server automatically when connectivity returns; pending count badge and sync status indicator keep the scorer informed; `useOnlineStatus` hook drives UI and queue-flush logic
- **Duplicate review panel** — Event Log tab now has a "Dupes" filter that surfaces all DB-flagged duplicate events (`is_possible_duplicate = true`); each flagged group shows a **Keep** button (clears the flag, broadcasts dismissal to co-scorers) and a **Delete** button (existing soft-delete flow); the tab label shows a live count badge when duplicates are present
- **`dismissDuplicateFlag` service** — `src/services/gameEvents.js`; clears `is_possible_duplicate` on all non-deleted rows in a group
- **`dismissDuplicate` hook action** — `useGameEvents` exposes `dismissDuplicate(groupId)`; optimistic local update + DB write + broadcast to co-scorers via `dismiss_duplicate` event
- **Realtime duplicate flag sync** — `postgres_changes` UPDATE handler now propagates `is_possible_duplicate` changes from the DB trigger and from co-scorer dismissals to all connected devices in real time

### Fixed
- **Realtime "Sync error" on SPA navigation** — navigating between pages caused `removeChannel()` on the last active channel to disconnect the Realtime socket, stopping the tenant; the next channel join would race against a tenant restart and be silently dropped. Fixed with a persistent `__keepalive__` channel in `src/lib/supabase.js` that keeps the socket alive for the lifetime of the app
- **`game_events` replica identity** — added `ALTER TABLE game_events REPLICA IDENTITY FULL` to support filtered `postgres_changes` UPDATE subscriptions on non-primary-key columns

---

## [2.2.0] — 2026-04-30

### Added
- **User profile page** (`/profile`) — display name, username/email display, change email, change password, and sign out; accessible via the initials avatar button in the top-right of the nav bar
- **Display name** — users can set a human-readable name stored in `profiles.display_name`; shown in place of username wherever names appear

### Security
- **`display_name` DB constraint** — `CHECK (char_length(display_name) <= 60)` enforced at the database level; the frontend `maxLength` is client-side only and bypassable via direct API calls
- **Email impersonation prevention** — email change rejects `@laxstats.app` addresses to prevent internal username impersonation

---

## [2.1.0] — 2026-04-29

### Added

**Test Coverage** (closes #10)
- Vitest + React Testing Library configured; 249 tests across 10 test files
- Unit tests for `src/utils/stats.js` — `buildPlayerStats`, `buildTeamTotals`, EMO/MDD derivation, edge cases
- Unit tests for `src/utils/game.js` — `getGameInfo`, `getLatestTime`, `formatDate` (UTC midnight trap), `formatDateLong`, `formatDateTime`
- Component tests for `LaxStats.jsx` — full step-flow (Team → Event → Player), undo logic, penalty box display (active/expired, NR badge, multi-player rows), remote entry merge and deduplication
- Component tests for `TimeKeypad.jsx` — digit entry, backspace, 4-digit cap, `maxSeconds` validation, ceiling enforcement (`allowEqualToCeiling`), `onConfirm` callback, "Same as latest" shortcut, invalid input display
- Integration tests for `useGameEvents.js` — `dbRowToEntry` translation for all field types, hook loading and error states
- Integration tests for `Scorekeeper.jsx` — presence badge visibility, Primary/Secondary role badges, scorer count, invite button gating by `isAnonymous` and `multi_scorer_enabled`, RPC invocation, invite link panel, sync and event error display

**Service Layer**
- `src/services/games.js` — `fetchGame`, `fetchGameMeta`, `updateGame`, `deleteGame`, `fetchOrgContext`, `canScoreGame`, `createScorekeeperInvite`, `claimScorekeeperInvite`, `deleteAllGameEvents`
- `src/services/gameEvents.js` — `fetchGameEvents`, `insertGameEvents`, `softDeleteGameEvents`
- `src/services/teams.js` — `fetchSavedTeams`
- All service functions accept an optional `db` parameter for dependency injection; service-level tests inject fake clients directly without `vi.mock`
- `useGameEvents` hook updated to accept `db` and pass it through to all service calls

### Fixed
- v2 games on the home screen showed 0–0 because scores were computed from `state.log`, which is empty for v2 games; `handleStateChange` now stores `score0`/`score1` in game state on every save; `getGameInfo` prefers stored scores when present
- `TimeKeypad` hid the user's typed digits when showing a "Seconds must be 00–59" error; the invalid parse (e.g. `0:90`) is now displayed in red so the input remains visible for backspacing
- Live game cards on `/` now show both scores in their team color (dimming of the trailing score is reserved for completed games)

### Security
- **Privilege escalation — `profiles` UPDATE policy** (`20260429000000`): the `profiles_update_own` RLS policy had no column restriction, allowing any authenticated user to self-elevate to admin via `supabase.from("profiles").update({ is_admin: true })`. Policy dropped; `REVOKE UPDATE ON profiles FROM authenticated` added as a belt-and-suspenders guard. `admin_set_admin` (SECURITY DEFINER) remains the only valid path.
- **Unauthorized scorekeeper access** (`20260429000001`): any authenticated user who knew a game UUID could open the scorekeeper UI; `game_events` SELECT was unrestricted; `create_scorekeeper_invite` did not check `multi_scorer_enabled`. Fixed by:
  - New `can_score_game(uuid)` RPC mirroring the INSERT policy (owner / org scorer / claimed invite); called in `loadGame` to gate the UI
  - `create_scorekeeper_invite` now rejects if `multi_scorer_enabled = false`
  - Deferred `loadGame` until token claim settles (prevents anonymous invite users from failing the auth check before their invite row is written)
  - Expired/invalid invite token now shows a clear error message instead of silently redirecting an anonymous user to the login screen

---

## [2.0.0] — 2026-04-27

LaxStats v2 promotes the platform from a single-user scorebook to a full league management system. The data model is rebuilt around organizations, seasons, and registered teams. Multi-user scoring is live. All existing v1 games continue to work unchanged during the transition period.

### Added

**Organizations, Seasons & Teams**
- **Organizations** — create an org at `/orgs/new`; members are assigned roles (org admin, coach, scorekeeper, viewer)
- **Org dashboard** (`/orgs/:slug`) — tabs for Games, Seasons, and Teams; live and pending games shown with status pills
- **Season management** — create seasons with date ranges; games can be linked to a season for aggregated stats
- **Team manager** (`/orgs/:slug/teams`) — create and manage registered teams with colors; add players with jersey numbers; build a base roster that carries forward into each season
- **Season rosters** — team rosters snapshot into each season; jersey number overrides per season
- **Org games** — create games under an org from `/games/new`; games link home/away teams and optionally a season
- **Move to org** — personal pending games can be transferred to an org from the game card
- **Org navigation hub** (`/orgs`) — lists all your org memberships; accessible via the Orgs tab in the top nav

**Multi-User Scoring**
- **Invite scorer links** — the primary scorer can generate a 24-hour invite link from the scorekeeper header; the link works in any browser with no account required (anonymous session)
- **Guest scoring** — following an invite link opens the scorekeeper directly; no login screen for guests
- **Primary / Secondary roles** — the first scorer to open a game is designated Primary; all others are Secondary. Primary scorer controls quarter endings; secondary scorers can log any event
- **Real-time sync** — events entered on any device appear instantly on all other connected scorers' screens via WebSocket broadcast
- **Quarter sync** — when the primary ends a quarter or finalizes the game, secondary scorers' views update automatically
- **Scorer count** — a badge in the scorekeeper header shows how many scorers are live on the game
- **Duplicate detection** — when a scorer tries to log a clock-anchored event (goal or timeout) that another scorer already entered at the same time, a confirmation modal prompts before inserting; prevents the most common double-entry mistake
- **Commit debounce** — a 500 ms guard on the commit button prevents accidental double-taps from inserting the same event twice in rapid succession

**Press Box Access Control**
- Press Box is now gated behind org plan features or a per-game admin override; personal games without an override no longer expose a press box link

**Admin Upgrades**
- **Per-game multi-scorer toggle** — enable or disable the scorer invite feature on any individual v2 game from the ⚙ panel in All Games
- **Per-game pressbox toggle** — enable the press box on any game regardless of org plan (existing feature, now also in the ⚙ panel)
- **Admin game delete fixed** — uses a `SECURITY DEFINER` RPC that correctly deletes `game_events` and `game_scorekeepers` child rows before deleting the game, bypassing RLS
- **New game for user** — admin-created games are now v2 (schema_ver=2) by default
- **Org management** — Orgs tab in the Admin panel for viewing and managing organizations
- **Delete user** — account deletion now removes all associated games and data

**v1 → v2 Migration**
- **Migration tool** in the Admin panel — converts existing v1 JSONB-log games into normalized `game_events` rows; includes dry-run mode and a goal-count verification gate before committing each game; idempotent (safe to re-run)

**Infrastructure**
- Normalized `game_events` table replaces `games.state.log[]` for all new games
- SQL views for per-game and per-season player and team stats (`v_game_player_stats`, `v_game_team_totals`, `v_season_player_stats`, `v_season_team_stats`)
- `game_scorekeepers` table for invite token management
- `schema_ver` column on `games` gates v1 (JSONB) vs v2 (normalized) code paths — v1 games continue to work unchanged
- Supabase Realtime publication enabled for `game_events` and `game_scorekeepers`
- Anonymous auth enabled for guest scorers

### Changed
- **Navigation** — top nav bar added sitewide (Home, Orgs, Admin); replaces the previous hero-embedded admin link
- **Sticky layout** — page heroes, tab bars, and section headers pin below the top nav on all pages; only content scrolls
- **Game creation** — `+ New Game` now opens a dedicated page with a choice between a personal game and an org game; org games include team and season selection
- **All new games are v2** — `schema_ver` defaults to 2; the v1 JSONB path remains fully supported for existing games

---

## [1.9.0] — 2026-04-24

### Changed
- **Time entry redesigned** — replaced the scrolling wheel picker with a numeric keypad (`TimeKeypad`) for goal, timeout, and penalty time entry; type 1–4 digits (seconds only, or M:SS) and confirm; the keypad validates against the quarter ceiling and shows live feedback; penalty time step includes a "Same as latest" shortcut for dead-ball cycles with multiple fouls

---

## [1.8.0] — 2026-04-23

### Added
- **Specific foul selection** — penalty entry now presents a full alphabetical list of 13 named fouls instead of a generic "Technical / Personal" choice; the type (tech/personal) is inferred automatically. Foul name is stored on the log entry and displayed throughout: timeline, event log, penalty box, and scorekeeper summary
- **Admin: delete game** — gear menu on each All Games row now includes a Danger Zone section with two-stage delete confirmation; row is removed immediately on success

### Changed
- **Penalty timeline display** — rows now show the specific foul name and duration (e.g. `🟨 Pushing (30s)`, `🟥 Slashing (2min NR)`) instead of generic "Technical foul" / "Personal foul" labels
- **Timeline header** — removed the "N goals, N timeouts, N penalties" count from all timeline views (Scorekeeper, Live View, Press Box)
- **Shot outcome buttons** — text centered (was left-aligned)
- **Foul selection buttons** — foul name centered with a colored type badge (`🟨 Technical` / `🟥 Personal`) below it
- **Undo button** — styled red with a pill background to stand out from the last-entry banner
- **Timeouts remaining** — text on team select buttons increased from 11px to 13px with higher opacity for readability
- **Penalty box home team indicator** — home team circle is now white with a colored border (matching the home team button style); away team remains a solid colored circle
- **Shared `<GameTimeline>` component** — timeline rendering extracted into `src/components/GameTimeline.jsx`; Live View and Press Box both consume it so all future timeline changes happen in one place
- **Sign out** — now navigates to `/` instead of `/login`

---

## [1.7.0] — 2026-04-22

### Added
- **Branding** — replaced emoji favicon with a full favicon package (SVG, PNG 96×96, ICO, 180×180 Apple touch icon, 192×512 PWA manifest icons); logo appears in the hero banner, login page, and all page headers (`/score`, `/view`, `/pressbox`)
- **Open Graph / social meta tags** — `og:title`, `og:description`, `og:image`, `og:url`, and Twitter card tags so shared links render a rich preview in iMessage, Slack, and similar apps
- **Game date capture** — setup screen includes a date field (defaults to today) so the actual game date is recorded separately from the Supabase `created_at` timestamp; date is stored in game state and displayed on game cards
- **Completed games grouped by date** — finished games in the My Games list are grouped under date headers (newest date first) rather than displayed as a flat list
- **Historical games for unauthenticated users** — the public home page (`/`) shows completed games grouped by date so anyone can browse past results without logging in
- **Admin: delete game** — gear menu on each All Games row now includes a Danger Zone section with a two-stage "Delete game → Yes, delete" confirmation; deleting removes the row immediately from the list
- **Admin: both dates visible** — All Games rows now show both the game date and the created date so admins can distinguish when a game was played from when it was entered

### Changed
- **Admin: sign-out destination** — signing out now navigates to `/` (public home) instead of `/login`
- **Live game date display** — once a game is live, the date field in setup is replaced with static text so the date cannot be accidentally changed mid-game
- **Footer** — changed to `position: fixed` with a `--footer-h` CSS variable consumed by full-viewport pages (Press Box) via `calc(100vh - var(--footer-h, 36px))`; content area uses matching `paddingBottom` so nothing slides behind the footer

### Fixed
- Games loaded mid-session no longer defaulted their date to today; date now initializes from `created_at` when no `gameDate` is present in state

---

## [1.6.0] — 2026-04-22

### Added
- **Public home page** — `/` now loads without login; unauthenticated visitors see a **Live Now** section showing all active games with View and Press Box links; a Sign In button appears in the hero; authenticated users see Live Now above their existing My Games and Rosters tabs, with a Score button on games they own; Live Now updates in real time
- **Global footer** — `© 2026 LaxStats · v{version}` appears in the document flow at the bottom of all pages except Press Box and Scorekeeper (which manage their own full-viewport layouts)

### Changed
- **Press Box layout redesigned** for fixed-viewport use (no page scroll):
  - Left half: single panel with a **Team Stats / Player Stats** toggle in the header; Player Stats retains the Home / Away team switch; panel scrolls internally
  - Right half: **Event Log** (60%) stacked above **Timeline** (40%), each independently scrollable; proportions set with flex so they always fill the available height
  - Score banner, Score by Quarter, and quarter filter remain full-width above the two-column grid
  - All table cells condensed (tighter padding and font sizes) to fit more content in the fixed viewport
- **`package.json` version** set to `1.5.0` (was `0.0.0` from scaffold default)

### Fixed
- Footer no longer overlays page content; removed `position: fixed` in favor of normal document flow so it sits below content rather than floating over it

---

## [1.5.0] — 2026-04-22

### Added
- **Press Box view** (`/games/:id/pressbox`) — public, full-width two-column dashboard for press box / announcer use (no login required):
  - **Score banner** — large live score with current quarter and clock
  - **Score by Quarter** — full-width table of per-quarter and total scores, sits between the banner and the quarter filter
  - **Team Stats** — complete stat breakdown grouped by section (Scoring, Defense, Shooting, Possession, Clearing, Penalties) with both teams side-by-side; updates in real time
  - **Player Stats** — sortable table per team; team toggle buttons (Home / Away) in the section header, colored with each team's color; defaults to the home team
  - **Event Log** — full read-only event log with sub-chips (assists, saves, blocks, times); scrollable once it exceeds ~480 px; NR penalties shown with a red highlighted chip
  - **Timeline** — goals, timeouts, and penalties in reverse chronological order with assist detail and running score; sits below the event log in the right column
  - Quarter filter affects all sections simultaneously; layout fills full browser width
- **Press Box button** on Live View (`/view`) header — navigates to the press box for the same game
- **Press Box button** on each game card in the Games list — direct access for logged-in users
- **Shot flow redesign** — after selecting the shooter, a single screen presents all four outcomes as vertical buttons (Missed, Saved, Blocked, Off the post); replaces the old sequential save/post/blocked Q&A
- **Last-goalie featured button** — in the save picker, the last known goalie (or current edit value) appears as a full-width button above the player grid for one-tap re-selection; the full grid remains below for substitutions
- **Penalties in Live View Timeline** — `/games/:id/view` Stats → Timeline now shows technical and personal fouls alongside goals and timeouts, with foul type, NR flag, player number, and score snapshot; penalty count included in the Timeline summary line

### Changed
- **Stats reorganized** across all stat views (Scorekeeper Summary, Live View Summary, Press Box Team Stats):
  - Assists moved into **Scoring** (was in Other)
  - Saves and Save % moved into **Defense** (were in Shooting)
  - Forced TOs moved into **Defense** (was in Possession)
  - Section headings (Scoring / Defense / Shooting / Possession / Clearing / Penalties) added to Scorekeeper and Live View Summary grids
- **Penalty NR question** rephrased to "Releasable or non-releasable?" with **Releasable** as the primary (black) button, since it is the more common outcome; Non-Releasable is the secondary outlined button

### Fixed
- Live View clock display now updates when a penalty is the only timed event logged in a quarter (penaltyTime was not being considered)
- Removed verbose console.log calls that serialized the full game state JSONB on every page load and realtime update, improving Live View load performance

---

## [1.2.1] — 2026-04-21

### Fixed
- Admin roster sharing panel used direct table operations blocked by RLS for non-owners; replaced with `admin_add_roster_share` and `admin_remove_roster_share` security-definer RPCs so share add/remove works for any roster regardless of ownership

---

## [1.2.0] — 2026-04-21

### Added
- **Admin: create game for user** — "New Game for User" button in All Games tab; select any user from a dropdown and create a game on their behalf; navigates directly to the new game's setup screen
- **Admin: create roster for user** — "New Roster for User" button in Rosters tab; select an owner, then fill in the roster details
- **Admin: game ownership reassignment** — ⚙ button on each game row reveals a user dropdown to transfer the game to a different owner
- **Admin: roster ownership reassignment** — Owner field in each roster's edit panel to transfer it to a different user
- **Admin: roster sharing management** — full sharing panel (add/remove shares by username) available for any roster in the admin Rosters tab
- **Admin: game links in Users tab** — each game in a user's expanded list now has View and Score/Setup buttons
- **Admin All Games: real-time clock updates** — Live pill updates as the scorekeeper enters timed events, without requiring a page refresh

### Fixed
- Admin All Games: pending games showed a "Score" button instead of "Setup"
- Admin All Games Live pill: `penaltyTime` was not considered when computing the latest recorded clock time
- Direct navigation to `/games/:id/view` returned 404 for unauthenticated users; fixed with a Vercel SPA rewrite rule (`vercel.json`)

---

## [1.1.0] — 2026-04-20

### Added
- **Penalty box** — active penalties displayed on the Track screen (above the End Q# button) with release time, NR badge, and cross-quarter label when a penalty carries into the next period
- **Consecutive foul support** — two penalties on the same player from the same dead-ball cycle are automatically chained; the second penalty is shown indented beneath the first and starts serving immediately when the first expires or is goal-released
- **Simultaneous foul support** — penalties from opposing teams logged at the same dead-ball time have their overlapping window automatically forced NR for both players
- **Non-releasable flag** — personal fouls can be marked NR during entry; NR penalties serve their full duration regardless of goals scored
- **Penalties in Timeline** — Stats → Timeline now includes penalty entries alongside goals and timeouts, with foul type, NR status, player, and score snapshot
- **Time entry for penalties** — penalty time wheel uses an inclusive ceiling so multiple penalties from the same dead-ball stoppage can share an identical timestamp

### Changed
- Penalty entry flow simplified: Tech or Personal → minutes (personal only) → NR? (personal only) → time remaining. Consecutive and simultaneous relationships are derived automatically from the log — no manual classification required
- Penalty box repositioned above the End Q# button so it is always visible without scrolling

### Fixed
- Penalties from independent dead-ball cycles were incorrectly chain-released when a prior penalty on the same player was goal-released; chain release now only propagates to windows that directly follow (consecutive fouls), not to unrelated later penalties

---

## [1.0.0] — 2026-04-20

First stable release. Adds full multi-user support with authentication, per-user data isolation, roster sharing, and an admin panel for platform management.

### Added
- **Admin panel** (`/admin`) — separate management interface accessible only to admin accounts
  - **All Games tab** — view every game across all users; Live games shown immediately, Pending and Final in collapsible sections
  - **Users tab** — list all accounts, toggle admin privileges, expand to see each user's games, create new accounts, and delete accounts (with two-stage confirmation)
  - **Rosters tab** — view all saved rosters grouped by owner; admins can edit any roster inline
- **Roster ownership** — saved teams are now owned by the user who created them; only owners can edit or delete their rosters
- **Roster sharing** — owners can share a roster with any other user by username; shared users can load the roster into games but cannot modify it
- **Per-user game isolation** — each user's Games tab shows only their own games; admin access to all games is scoped to `/admin`
- **Game list grouping** — Live and Pending games shown directly; completed games collapsed under a toggle
- **Admin badge** in the hero header for admin accounts with a direct link to `/admin`
- Username-based account creation from the admin panel (no email required)
- Two-stage delete confirmation for user accounts, matching the existing game delete flow

### Changed
- Roster editor extracted as a shared component, reused across the user-facing Rosters tab and the admin Rosters tab
- `LaxStats` app wrapper no longer sets `min-height: 100vh`, eliminating phantom scroll space on the Scorekeeper screen

### Fixed
- iOS rubber-band scroll on the Scorekeeper screen (`overscroll-behavior: none`)
- Spurious "Save failed" in development caused by React StrictMode double-firing effects (StrictMode removed)
- Infinite recursion in Supabase RLS policies caused by a self-referential `profiles` admin check; resolved by dropping the recursive policy

---

## [0.5.0] — 2026-04-19

### Added
- **Authentication** — email/password accounts via Supabase Auth; all scorekeeper routes are now protected
- **Username login** — users sign in with a short username; the app appends `@laxstats.app` automatically (a real email with `@` is also accepted)
- **Per-user game visibility** — games are scoped to the creating user's account; RLS enforces this at the database level
- Sign up / sign in toggle on the login screen

---

## [0.4.0] — 2026-04-17

### Added
- **MDD Stop** event — log when the defense kills a penalty without conceding; automatically credits the opponent with a Failed EMO
- **Shot on Goal (SOG)** tracking — goals, saves, and post/crossbar hits all count as SOG; blocked shots do not
- **EMO / MDD percentage** stats derived automatically from logged events
- **Timeout logging** with time remaining; timeout counts per half enforced in the UI (2 per team per half, 1 per OT period)
- **Time ceiling** on entry — new timed events must be at or before the most recent recorded time in the quarter
- **Shot flow redesign** — saved → post/crossbar → blocked → missed, each with proper stat attribution
- Time scroll wheel opens pre-positioned at the last recorded time for the current quarter

### Changed
- Stats tab reorganized to show EMO, MDD, and shooting stats alongside scoring
- Docs rewritten to cover new event types and stat definitions

---

## [0.3.0] — 2026-04-16

### Added
- **Home / Away distinction** — left team is always Home (white-bordered buttons), right team is Away (solid color); mirrors jersey colors on the field
- **Roster validation** — duplicate player numbers highlighted in red and block game start; minimum 10 players per team required
- **Cancel setup** — Discard Game button on the setup screen before tracking begins
- **Pending status** — games that exist but haven't started show a `● Pending` pill instead of a blank status

### Changed
- Team select buttons in the Track screen show jersey-style colors (home = white border, away = solid)
- Player grid uses matching button styles for quick visual identification

---

## [0.2.0] — 2026-04-15

### Added
- **Roster manager** — save team rosters with name, color, and player list; load into any game in one tap
- **Game delete** — trash icon on each game card with two-stage confirmation
- **Saved team loader** — `Load saved…` dropdown in game setup auto-fills name, color, and roster
- **CSV upload** — import a roster from a CSV file in the setup screen
- **LaxStats rebrand** — new name, logo, and lacrosse field SVG background on the main screen
- Emoji favicon (🥍)
- User guide (`USER_GUIDE.md`) and rewritten README

### Changed
- Main screen redesigned with dark hero header and field background
- App renamed from NDPBLAX to LaxStats in all references

---

## [0.1.0] — 2026-04-15

Initial release — a working lacrosse stat tracker for a single user.

### Added
- Create and manage games
- Track goals, assists, shots, ground balls, faceoff wins, turnovers, forced turnovers, penalties, clears, and rides
- Automatic derivation of rides (from opponent clears) and forced TOs
- Quarter management with end-of-quarter confirmation and stat summary
- Overtime (sudden death) — game auto-finalizes on first OT goal
- Event log with edit and delete for any entry at any time
- Undo last entry
- Summary, Players, and Timeline stat views with quarter filter
- Sortable player stats table
- **Live View** — public read-only URL updates in real time; no account required to view
- Export / import game state as JSON
- Supabase backend for persistent storage and real-time sync
