# Changelog

All notable changes to LaxStats are documented here.
Versioning follows [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`.

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
