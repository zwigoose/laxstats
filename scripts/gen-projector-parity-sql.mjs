#!/usr/bin/env node
/**
 * Emit a projector-parity SQL check from the shared event-stream fixtures
 * (src/test/fixtures/eventStreams/). Usage:
 *
 *   node scripts/gen-projector-parity-sql.mjs > /tmp/projector-parity.sql
 *
 * The output is ONE PL/pgSQL DO block that:
 *   1. inserts a throwaway auth user + the fixture games/events/meta rows
 *      (firing the project_game triggers; fixture metaEvents are written as
 *      meta-kind stream rows, mirroring how the Phase 3 migration copied the
 *      since-dropped game_meta_events table into the stream),
 *   2. asserts games.summary equals each fixture's expected.summary,
 *   3. always raises an exception at the end — 'PARITY OK …' on success —
 *      so the whole block rolls back and leaves no data behind.
 *
 * Run it against any environment with migrations applied (local stack psql,
 * or staging via the Supabase SQL editor / MCP execute_sql). Success = error
 * message starting with 'PARITY OK'. Anything else = drift.
 *
 * The same expected.summary blocks are asserted against reduceGame() in
 * src/test/eventStreams.test.js — that is the reducer/projector parity link.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../src/test/fixtures/eventStreams");
const TEST_USER = "eeeeeeee-0000-0000-0000-00000000e2e1";

const fixtures = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(FIXTURE_DIR, f), "utf8")));

const lit = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const jsonLit = (v) => `${lit(JSON.stringify(v))}::jsonb`;

const gameId = (f) => f.events[0]?.game_id ?? f.metaEvents[0]?.game_id
  ?? `00000000-0000-0000-0000-00000000ff${String(fixtures.indexOf(f)).padStart(2, "0")}`;

// legacy-state-only stays schema_ver 1 to prove the projector leaves v1 games alone.
const schemaVer = (f) => (f.name === "legacy-state-only" ? 1 : 2);

let sql = `DO $parity$
DECLARE
  v jsonb;
BEGIN
  INSERT INTO auth.users (id, aud, role, email)
  VALUES ('${TEST_USER}', 'authenticated', 'authenticated', 'projector-parity@test.local');

`;

for (const f of fixtures) {
  const gid = gameId(f);
  sql += `  -- ── ${f.name} ──\n`;
  sql += `  INSERT INTO games (id, user_id, name, state, schema_ver)\n`;
  sql += `  VALUES ('${gid}', '${TEST_USER}', ${lit(`parity ${f.name}`)}, ${jsonLit(f.game.state)}, ${schemaVer(f)});\n`;

  for (const e of f.events) {
    sql += `  INSERT INTO game_events (id, game_id, group_id, seq, quarter, event_type, team_idx, is_team_stat, player_num, player_name, goal_time, penalty_time, timeout_time, penalty_minutes, is_non_releasable, shot_outcome, shot_zone, payload, deleted_at, deleted_by, created_by, client_created_at)
  VALUES ('${e.id}', '${gid}', '${e.group_id}', ${e.seq}, ${e.quarter ?? "NULL"}, ${lit(e.event_type)}, ${e.team_idx ?? "NULL"}, ${e.is_team_stat ?? false}, ${lit(e.player_num)}, ${lit(e.player_name)}, ${lit(e.goal_time)}, ${lit(e.penalty_time)}, ${lit(e.timeout_time)}, ${e.penalty_minutes ?? "NULL"}, ${e.is_non_releasable ?? false}, ${lit(e.shot_outcome)}, ${lit(e.shot_zone)}, ${e.payload !== undefined ? jsonLit(e.payload) : "NULL"}, ${lit(e.deleted_at)}, ${e.deleted_at ? `'${TEST_USER}'` : "NULL"}, '${TEST_USER}', ${lit(e.client_created_at)});\n`;
  }
  for (const m of f.metaEvents) {
    // Meta-kind stream rows; seq omitted so the global sequence assigns them
    // after the stat rows, preserving fixture order (matches the backfill).
    sql += `  INSERT INTO game_events (id, game_id, group_id, event_type, payload, created_by, client_created_at)
  VALUES ('${m.id}', '${gid}', '${m.id}', ${lit(m.event_type)}, ${jsonLit({ fromQuarter: m.from_quarter, toQuarter: m.to_quarter })}, '${TEST_USER}', ${lit(m.client_created_at)});\n`;
  }

  if (f.expected.summary === null) {
    sql += `  SELECT summary INTO v FROM games WHERE id = '${gid}';
  IF v IS NOT NULL THEN
    RAISE EXCEPTION 'PARITY FAIL ${f.name}: v1 game got a summary: %', v;
  END IF;\n\n`;
    continue;
  }

  sql += `  SELECT summary INTO v FROM games WHERE id = '${gid}';
  IF v IS NULL THEN
    RAISE EXCEPTION 'PARITY FAIL ${f.name}: summary is NULL (projector did not run)';
  END IF;
  IF v <> ${jsonLit(f.expected.summary)} THEN
    RAISE EXCEPTION 'PARITY FAIL ${f.name}: % <> expected %', v, ${jsonLit(f.expected.summary)};
  END IF;\n\n`;
}

// The games.state projection trigger is gone (final cleanup) — state writes
// no longer re-project, and register events remain authoritative.
const liveFixture = fixtures.find((f) => f.name === "basic-scoring");
sql += `  -- a register event projects immediately and a later state write changes nothing
  INSERT INTO game_events (id, game_id, group_id, event_type, team_idx, payload, created_by)
  VALUES (gen_random_uuid(), '${gameId(liveFixture)}', gen_random_uuid(), 'team_profile_set', 0,
          '{"name":"Register Home","color":"#abc","logoUrl":null}'::jsonb, '${TEST_USER}');
  UPDATE games SET state = jsonb_set(state, '{teams,0,name}', '"Clobbered"')
  WHERE id = '${gameId(liveFixture)}';
  SELECT summary INTO v FROM games WHERE id = '${gameId(liveFixture)}';
  IF v #>> '{teams,0,name}' <> 'Register Home' THEN
    RAISE EXCEPTION 'PARITY FAIL register-lww: expected Register Home, got %', v #>> '{teams,0,name}';
  END IF;

  -- soft-delete re-projection drops the goal from the score
  UPDATE game_events SET deleted_at = now(), deleted_by = '${TEST_USER}'
  WHERE id = '00000000-0000-0000-0001-000000000003';
  SELECT summary INTO v FROM games WHERE id = '${gameId(liveFixture)}';
  IF (v ->> 'score0')::int <> 0 THEN
    RAISE EXCEPTION 'PARITY FAIL soft-delete: score0 should drop to 0, got %', v ->> 'score0';
  END IF;

  -- validation trigger rejects unknown event types
  BEGIN
    INSERT INTO game_events (game_id, group_id, seq, quarter, event_type, team_idx, created_by)
    VALUES ('${gameId(liveFixture)}', gen_random_uuid(), 999999, 1, 'not_a_real_type', 0, '${TEST_USER}');
    RAISE EXCEPTION 'PARITY FAIL validation: unknown event_type was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'unknown event_type%' THEN RAISE; END IF;
  END;

  -- validation trigger rejects state/meta events without payload
  BEGIN
    INSERT INTO game_events (game_id, group_id, event_type, team_idx, created_by)
    VALUES ('${gameId(liveFixture)}', gen_random_uuid(), 'roster_set', 0, '${TEST_USER}');
    RAISE EXCEPTION 'PARITY FAIL validation: payload-less state event was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%requires payload%' THEN RAISE; END IF;
  END;

  RAISE EXCEPTION 'PARITY OK — all fixtures match games.summary; rolling back test data';
END
$parity$;
`;

process.stdout.write(sql);
