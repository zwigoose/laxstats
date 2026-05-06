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

### Two Scoring Modes

There are two parallel data architectures in this codebase:

- **v1** — personal games, score stored as a JSONB blob in `games.log_json`
- **v2** — org-linked games, score stored as normalized rows in `game_events` with Supabase Realtime subscriptions and multi-scorer support

A game's version is determined by whether it has an `org_id`. Many components branch on this. The `game_events` table uses soft deletes (`deleted_at`, `deleted_by`) rather than hard deletes. Duplicate detection (`is_possible_duplicate`) alerts scorers to potential double-entries.

### Key Layers

| Layer | Location | Role |
|---|---|---|
| Pages | `src/pages/` | Route-level components; mostly thin wrappers that compose hooks |
| Components | `src/components/` | Reusable UI; `LaxStats.jsx` is the monolithic ~114KB scorekeeper input UI |
| Hooks | `src/hooks/` | `useGameEvents` is the core—handles Realtime subscription, offline queue, and event reconciliation |
| Services | `src/services/` | Supabase query functions (`games.js`, `gameEvents.js`, `teams.js`, `offlineQueue.js`) |
| Utils | `src/utils/` | `stats.js` computes all derived stats in JS (no DB aggregation); `game.js` for roster/time helpers |
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

Supabase PostgreSQL with 45+ migrations in `supabase/migrations/`. Local dev uses:
- API: port 54321
- DB: port 54322

Key v2 schema tables: `organizations`, `seasons`, `teams`, `org_members`, `game_events`, `game_scorers`, `scorekeeper_invites`. RLS policies enforce org role checks on all sensitive tables. Admin/org management goes through RPCs rather than direct table writes.

## Environments

| File | Environment |
|---|---|
| `.env.local` | Staging Supabase (`VITE_IS_STAGING=true`) |
| `.env.staging` | Staging Supabase |
| `.env.production` | Production Supabase |

Both envs use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Deployed to Vercel (`vercel.json`).
