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

- **`game_events`** — normalized rows for every scored action (goal, shot, penalty, etc.) with soft deletes (`deleted_at`, `deleted_by`) and duplicate detection (`is_possible_duplicate`)
- **`game_meta_events`** — immutable rows for quarter-start, quarter-end, and game-over transitions; `deriveQuarterState()` replays these to reconstruct authoritative quarter/game-over state
- **`games.state`** — a denormalized JSONB display cache written by the scorekeeper; holds `teams` (roster), `trackingStarted`, `gameOver`, `currentQuarter`, `score0`, `score1`, and `gameDate` so the game list can render Live/Final status and scores without querying `game_events`

The only distinction between game types is whether a game has an `org_id` (org-linked) or not (personal). There is no separate v1/v2 data model split — that architecture was removed in v2.12.0.

### Key Layers

| Layer | Location | Role |
|---|---|---|
| Pages | `src/pages/` | Route-level components; mostly thin wrappers that compose hooks |
| Components | `src/components/` | Reusable UI; `LaxStats/index.jsx` is the monolithic scorekeeper input UI |
| Hooks | `src/hooks/` | `useGameEvents` is the core — handles Realtime subscription, offline queue, event reconciliation, and `game_meta_events` commits |
| Services | `src/services/` | Supabase query functions (`games.js`, `gameEvents.js`, `teams.js`, `offlineQueue.js`) |
| Utils | `src/utils/` | `stats.js` computes all derived stats in JS (no DB aggregation); `game.js` has date formatting and `getGameInfo()` for reading the `games.state` display cache |
| Contexts | `src/contexts/` | `AuthContext` loads session + profile + org memberships on mount |
| Lib | `src/lib/supabase.js` | Supabase client with Realtime keepalive channel to prevent WebSocket drop |

### Offline Sync

`useGameEvents` maintains a localStorage-based offline queue (`offlineQueue.js`). Events logged offline are buffered and flushed on reconnect with duplicate deduplication. `useOnlineStatus` drives visibility of the sync state. This is the most complex area of the codebase.

### Stats Computation

All player/team stats are computed in `src/utils/stats.js` via `buildPlayerStats()`. This runs over the in-memory event list after every sync — there is no server-side aggregation. Stats include goals, assists, shots, ground balls, faceoffs, turnovers, forced TOs, penalties, clears, failed clears, rides, MDD (man-down defense), EMO%, save%, clearing%, and GB%.

### Auth & Roles

`AuthContext` provides session, profile, and `getOrgRole(slug)` which returns the user's role per org (`org_admin`, `coach`, `scorekeeper`, `viewer`). `PrivateRoute` gates authenticated pages. Scorekeeper invite links (`claimScorekeeperInvite` RPC) grant temp scoring access without requiring accounts (24h expiry).

### Routing

React Router v7. Scorekeeper (`/games/:id/score`) and Pressbox (`/games/:id/pressbox`) routes suppress global nav/footer via a `NO_NAV` regex in `App.jsx` — they're full-viewport experiences. All other routes render the standard chrome.

## Database

Supabase PostgreSQL with 69+ migrations in `supabase/migrations/`. Local dev uses:
- API: port 54321
- DB: port 54322

Key schema tables: `organizations`, `seasons`, `teams`, `org_members`, `games`, `game_events`, `game_meta_events`, `game_scorers`, `scorekeeper_invites`. RLS policies enforce org role checks on all sensitive tables. Admin/org management goes through RPCs rather than direct table writes.

## Environments

| File | Environment |
|---|---|
| `.env.local` | Staging Supabase (`VITE_IS_STAGING=true`) |
| `.env.staging` | Staging Supabase |
| `.env.production` | Production Supabase |

Both envs use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Deployed to Vercel (`vercel.json`).
