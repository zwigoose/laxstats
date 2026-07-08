-- ═══════════════════════════════════════════════════════════════════════════
-- Event-sourcing refactor, final cleanup: drop the transition scaffolding
--
-- Every quarter transition lives in the unified game_events stream (copied
-- with deterministic ids in Phase 3; new writes forwarded since). With no
-- active scoring sessions there are no stale pre-Phase-3 browser bundles
-- left to serve, so the legacy table, its forwarding bridge, and the
-- games.state projection trigger can go.
--
-- Kept: trg_games_insert_project (+ trg_project_game_state()) — new games
-- still need their initial projection — and trg_games_00_state_freeze as a
-- guard on ver-3 games.
-- ═══════════════════════════════════════════════════════════════════════════

-- games.state is frozen and clients no longer write it; the projector no
-- longer needs to chase state writes.
DROP TRIGGER IF EXISTS trg_games_state_project ON games;

-- Legacy quarter-transition table + forwarding bridge.
DROP TRIGGER  IF EXISTS trg_game_meta_events_forward ON game_meta_events;
DROP FUNCTION IF EXISTS trg_forward_meta_events();
DROP FUNCTION IF EXISTS copy_meta_event_to_stream(game_meta_events);
DROP TABLE    IF EXISTS game_meta_events;

NOTIFY pgrst, 'reload schema';
