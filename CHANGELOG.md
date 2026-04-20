# Changelog

All notable changes to LaxStats are documented here.
Versioning follows [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`.

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
