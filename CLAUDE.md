# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Vite dev server (uses .env.local → staging Supabase)
npm run build          # Production build
npm run build:staging  # Staging build
npm run lint           # ESLint
npm run test           # Vitest watch mode
npm run test:run       # Single test run
npm run test:coverage  # Coverage report
```

## What This Is

**LaxStats** — a digital scorebook and league management platform for men's lacrosse. React + Supabase SPA with no custom backend; all persistence goes through Supabase (PostgreSQL + Realtime).

## Architecture Overview

### Data Model

All games — personal and org-linked — use the same event-sourced data model:

- **`game_events`** — the unified event stream (event-sourcing Phase 3). Three kinds, classified by `event_type_registry` and mirrored in `src/domain/eventTypes.js`: **stat** rows for scored actions (goal, shot, penalty, …) with soft deletes and duplicate detection; **meta** rows for quarter transitions (`quarter_end`/`game_over`/`quarter_override` with `{fromQuarter, toQuarter}` payloads); **state** rows as LWW registers for setup (`team_profile_set`, `roster_set`, `goalie_set`, `goalie_decisions_set`, `logistics_set`, `tracking_started` — full-snapshot payloads, latest by `seq` wins). `src/domain/reduceGame.js` is the pure JS twin of the SQL projector; parity is enforced by shared fixtures (`src/test/fixtures/eventStreams/`, `expected.summary`)
- `game_meta_events` no longer exists — quarter transitions were copied into the stream with deterministic ids and the legacy table, its forwarding trigger, and the `games` state-projection trigger were dropped once no stale pre-refactor clients remained
- **`games.summary`** — a **server-maintained** JSONB read cache projected by the `project_game()` Postgres function, re-run by triggers on every `game_events` / `game_meta_events` write (and, during the transition, on `games.state` writes). Holds scores, quarter state, `trackingStarted`, plus pass-throughs of not-yet-event-sourced fields (`teams`, goalies, logistics). Display readers use `summary ?? state` via `getGameInfo()`. Projector failures land in `projector_failures` without blocking the scorer's write; the `refresh_game_summary(game_id)` RPC re-projects on demand. v1 games (`schema_ver < 2`) are never projected — their `summary` stays NULL and they render from `state` forever
- **`games.state`** — the legacy denormalized JSONB cache, now **frozen** (event-sourcing Phase 4): the scorekeeper no longer writes it, games created at `schema_ver 3` reject state writes via a silent-ignore trigger, and it survives only as the projector's fallback for games that predate state events. Scorekeeper hydration replays the stream via `reduceGame(rows, summary ?? state)`
- **`event_type_registry`** — classifies every `event_type` (`stat` / `state` / `meta`) and drives insert validation on `game_events`; unknown event types are rejected at insert
- **Quarter corrections** — undoing an accidental quarter transition = tombstoning its meta event (replay heals the quarter machine); mis-stamped events move via the `relabel_event_quarters` RPC; `quarter_override` replay reconciles `completedQuarters` (quarters ≥ the target un-complete). See `computeQuarterFix()` in `src/domain/reduceGame.js`

The only distinction between game types is whether a game has an `org_id` (org-linked) or not (personal). There is no separate v1/v2 data model split — that architecture was removed in v2.12.0.

### Key Layers

| Layer | Location | Role |
|---|---|---|
| Pages | `src/pages/` | Route-level components; mostly thin wrappers that compose hooks |
| Components | `src/components/` | Reusable UI; `LaxStats/index.jsx` is the monolithic scorekeeper input UI |
| Hooks | `src/hooks/` | `useGameLog` is the core — outbox-first writes, Realtime subscription, event reconciliation, and `game_meta_events` commits |
| Services | `src/services/` | Supabase query functions (`games.js`, `gameEvents.js`, `teams.js`) and the offline `outbox.js` |
| Utils | `src/utils/` | `stats.js` computes all derived stats in JS (no DB aggregation); `game.js` has date formatting and `getGameInfo()` for reading the `games.state` display cache |
| Contexts | `src/contexts/` | `AuthContext` loads session + profile + org memberships on mount |
| Lib | `src/lib/supabase.js` | Supabase client with Realtime keepalive channel to prevent WebSocket drop |

### Offline Sync

`useGameLog` is **outbox-first**: every write (event group, quarter meta event, soft-delete) is enqueued as an op in a single IndexedDB store (`src/services/outbox.js`), then flushed in strict FIFO order when online — there is one code path whether online or offline. Appends carry client-generated row ids and go up as upsert-ignore, so a crashed or retried flush is idempotent. A hard (non-network) flush failure drops the op and surfaces the error instead of jamming the queue. Soft-deletes go through the `soft_delete_event_group` RPC (gated by `can_score_game`) so secondary scorers can delete the primary's entries. `useOnlineStatus` drives visibility of the sync state.

### Stats Computation

All player/team stats are computed in `src/utils/stats.js` via `buildPlayerStats()`. This runs over the in-memory event list after every sync — there is no server-side aggregation. Stats include goals, assists, shots, ground balls, faceoffs, turnovers, forced TOs, penalties, clears, failed clears, rides, MDD (man-down defense), EMO%, save%, clearing%, and GB%.

**Auto-derived stats — never manually entered:**
- **EMO / FEMO** — detected automatically at goal time by checking whether the defending team is net shorthanded via `computePenaltyWindows()`; no scorer input required
- **MDD / FMDD** — computed from penalty windows that expire without a goal scored against; auto-credited as the inverse of FEMO

### Auth & Roles

`AuthContext` provides session, profile, and `getOrgRole(slug)` which returns the user's role per org (`org_admin`, `coach`, `scorekeeper`, `viewer`). `PrivateRoute` gates authenticated pages. Scorekeeper invite links (`claimScorekeeperInvite` RPC) grant temp scoring access without requiring accounts (24h expiry).

### Routing

React Router v7. Scorekeeper (`/games/:id/score`) and Pressbox (`/games/:id/pressbox`) routes suppress global nav/footer via a `NO_NAV` regex in `App.jsx` — they're full-viewport experiences. All other routes render the standard chrome.

## Database

Supabase PostgreSQL with 80 migrations in `supabase/migrations/`. Local dev uses:
- API: port 54321
- DB: port 54322

Key schema tables: `organizations`, `seasons`, `teams`, `org_members`, `games`, `game_events`, `game_meta_events`, `game_scorers`, `scorekeeper_invites`. RLS policies enforce org role checks on all sensitive tables. Admin/org management goes through RPCs rather than direct table writes.

### Storage

Two public Supabase Storage buckets. Both are public-read; writes require authentication and are enforced via RLS policies on `storage.objects`.

| Bucket | Purpose | Path convention |
|---|---|---|
| `org-logos` | Org-level and org-team logos | `{orgId}/logo` · `{orgId}/teams/{teamId}/logo` |
| `game-logos` | Per-game logo overrides and saved-team logos | `{gameId}/{teamIdx}/logo` · `saved/{teamId}/logo` |

Logo URLs are stored in: `teams.logo_url` (org teams), `saved_teams.logo_url`, and `games.state.teams[i].logoUrl` (per-game cache). When rendering logos from Supabase storage in `html-to-image` contexts, `crossOrigin="anonymous"` is required on `<img>` elements.

## Environments

| File | Environment |
|---|---|
| `.env.local` | Staging Supabase (`VITE_IS_STAGING=true`) |
| `.env.staging` | Staging Supabase |
| `.env.production` | Production Supabase |

Both envs use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Deployed to Vercel (`vercel.json`).

## Release Workflow

When shipping a feature to staging:

1. **Feature branch** — work on `feature/<name>` branched from `staging`; include `README.md` and `USER_GUIDE.md` updates in the branch so docs are reviewed alongside code in the PR
2. **PR** — open into `staging`; review covers both code and documentation
3. **After merge** — bump `"version"` in `package.json` and add a `CHANGELOG.md` entry (semver: minor for new features, patch for fixes); commit directly to `staging`
