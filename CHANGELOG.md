# Changelog

All notable changes to LaxStats are documented here.
Versioning follows [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`.

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
