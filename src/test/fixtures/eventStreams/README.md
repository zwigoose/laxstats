# Event-stream fixtures

Shared fixture corpus for the event-sourcing refactor. Each fixture is one
game: its raw `game_events` / `game_meta_events` rows (DB column naming,
seq-ordered), the `games.state` blob a client would have persisted, and the
expected derived values.

These fixtures are consumed by, in rollout order:

1. **Phase 0 (now)** — `src/test/eventStreams.test.js` characterization tests
   locking in today's behavior of `deriveQuarterState()`, the goal-count score
   recompute, and `getGameInfo()`.
2. **Phase 1** — SQL parity tests: the same rows are inserted into a local
   Supabase stack and `games.summary` (written by the `project_game()`
   projector) must match `expected`.
3. **Phase 3** — `reduceGame()` (the projector's JS twin) must produce the
   same snapshot from the same rows. Any reducer/projector drift fails CI.

## Format

```jsonc
{
  "name": "kebab-case-id",
  "description": "what this fixture exercises",
  "game": {                    // the games row (subset)
    "created_at": "...",
    "state": { ... }           // as persisted by the client today:
  },                           // log/completedQuarters stripped, score0/1 cached
  "events": [ ... ],           // game_events rows, snake_case, ordered by seq
  "metaEvents": [ ... ],       // game_meta_events rows, ordered by seq
  "expected": {
    "quarterState": { "currentQuarter": 1, "completedQuarters": [], "gameOver": false } | null,
    "eventScores": { "score0": 0, "score1": 0 },   // derived from live (non-deleted) events
    "gameInfo": { ... }        // subset of getGameInfo() output, matched with toMatchObject
  }
}
```

Notes:

- `expected.quarterState` is `null` when there are no meta events — that is
  `deriveQuarterState()`'s current contract.
- `quarter-anomalies` intentionally locks in today's replay quirks (duplicate
  `quarter_end` rows double-append `completedQuarters`). If Phase 3 changes
  that behavior deliberately, update the fixture in the same PR and call it
  out in review.
- Clock times exist only on goals, penalties, and timeouts — a permanent
  product decision. `seq` is the canonical play-by-play order.
