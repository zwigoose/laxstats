import { describe, it, expect } from "vitest";
import { dbRowToEntry, entryToDbRow } from "./useGameEvents";

// ── dbRowToEntry ──────────────────────────────────────────────────────────────

describe("dbRowToEntry", () => {
  const base = {
    id: "uuid-row",
    seq: 5,
    group_id: "uuid-group",
    team_idx: 0,
    event_type: "goal",
    player_num: "7",
    player_name: "Alice",
    quarter: 2,
    is_team_stat: false,
    goal_time: "5:30",
    penalty_time: null,
    timeout_time: null,
    is_non_releasable: false,
    penalty_minutes: null,
    shot_outcome: null,
    foul_name: null,
  };

  it("maps core fields correctly", () => {
    const entry = dbRowToEntry(base);
    expect(entry.id).toBe(5);         // seq
    expect(entry.dbId).toBe("uuid-row");
    expect(entry.groupId).toBe("uuid-group");
    expect(entry.teamIdx).toBe(0);
    expect(entry.event).toBe("goal");
    expect(entry.quarter).toBe(2);
    expect(entry.seq).toBe(5);
  });

  it("maps player fields when player_num is present", () => {
    const entry = dbRowToEntry(base);
    expect(entry.player).toEqual({ num: "7", name: "Alice" });
  });

  it("falls back to #num when player_name is null", () => {
    const entry = dbRowToEntry({ ...base, player_name: null });
    expect(entry.player).toEqual({ num: "7", name: "#7" });
  });

  it("returns null player when player_num is null", () => {
    const entry = dbRowToEntry({ ...base, player_num: null });
    expect(entry.player).toBeNull();
  });

  it("maps optional time fields", () => {
    const entry = dbRowToEntry(base);
    expect(entry.goalTime).toBe("5:30");
    expect(entry.penaltyTime).toBeUndefined();
    expect(entry.timeoutTime).toBeUndefined();
  });

  it("maps penalty_time when present", () => {
    const entry = dbRowToEntry({ ...base, penalty_time: "3:00" });
    expect(entry.penaltyTime).toBe("3:00");
  });

  it("maps shot_outcome when present", () => {
    const entry = dbRowToEntry({ ...base, shot_outcome: "saved" });
    expect(entry.shotOutcome).toBe("saved");
  });

  it("maps foul_name when present", () => {
    const entry = dbRowToEntry({ ...base, foul_name: "Holding" });
    expect(entry.foulName).toBe("Holding");
  });

  it("maps is_non_releasable correctly", () => {
    expect(dbRowToEntry({ ...base, is_non_releasable: true }).nonReleasable).toBe(true);
    expect(dbRowToEntry({ ...base, is_non_releasable: false }).nonReleasable).toBe(false);
  });

  it("maps is_team_stat with null fallback", () => {
    expect(dbRowToEntry({ ...base, is_team_stat: true }).teamStat).toBe(true);
    expect(dbRowToEntry({ ...base, is_team_stat: null }).teamStat).toBe(false);
  });

  it("maps penalty_minutes when present", () => {
    const entry = dbRowToEntry({ ...base, penalty_minutes: 2 });
    expect(entry.penaltyMin).toBe(2);
  });

  it("maps shot_zone when present", () => {
    const entry = dbRowToEntry({ ...base, shot_zone: "C1" });
    expect(entry.zone).toBe("C1");
  });

  it("leaves zone undefined when shot_zone is null", () => {
    const entry = dbRowToEntry({ ...base, shot_zone: null });
    expect(entry.zone).toBeUndefined();
  });

  it("maps is_emo flag when true", () => {
    const entry = dbRowToEntry({ ...base, is_emo: true });
    expect(entry.emo).toBe(true);
  });

  it("leaves emo undefined when is_emo is false", () => {
    const entry = dbRowToEntry({ ...base, is_emo: false });
    expect(entry.emo).toBeUndefined();
  });
});

// ── entryToDbRow ──────────────────────────────────────────────────────────────

describe("entryToDbRow", () => {
  const baseEntry = {
    groupId:    "uuid-group",
    quarter:    2,
    event:      "goal",
    teamIdx:    0,
    teamStat:   false,
    player:     { num: "7", name: "Alice" },
    goalTime:   "5:30",
    seq:        3,
  };
  const GAME_ID = "game-uuid";
  const USER_ID = "user-uuid";

  it("maps core fields to DB columns", () => {
    const row = entryToDbRow(baseEntry, GAME_ID, USER_ID);
    expect(row.game_id).toBe(GAME_ID);
    expect(row.group_id).toBe("uuid-group");
    expect(row.quarter).toBe(2);
    expect(row.event_type).toBe("goal");
    expect(row.team_idx).toBe(0);
    expect(row.is_team_stat).toBe(false);
    expect(row.created_by).toBe(USER_ID);
  });

  it("maps player fields when player is present", () => {
    const row = entryToDbRow(baseEntry, GAME_ID, USER_ID);
    expect(row.player_num).toBe("7");
    expect(row.player_name).toBe("Alice");
  });

  it("sets player_num and player_name to null when player is null", () => {
    const row = entryToDbRow({ ...baseEntry, player: null }, GAME_ID, USER_ID);
    expect(row.player_num).toBeNull();
    expect(row.player_name).toBeNull();
  });

  it("maps goal_time", () => {
    const row = entryToDbRow(baseEntry, GAME_ID, USER_ID);
    expect(row.goal_time).toBe("5:30");
    expect(row.penalty_time).toBeNull();
    expect(row.timeout_time).toBeNull();
  });

  it("maps penalty_time for penalty entries", () => {
    const row = entryToDbRow({ ...baseEntry, event: "penalty_min", goalTime: undefined, penaltyTime: "3:00", penaltyMin: 2, nonReleasable: false }, GAME_ID, USER_ID);
    expect(row.penalty_time).toBe("3:00");
    expect(row.penalty_minutes).toBe(2);
    expect(row.is_non_releasable).toBe(false);
  });

  it("maps is_non_releasable true", () => {
    const row = entryToDbRow({ ...baseEntry, nonReleasable: true }, GAME_ID, USER_ID);
    expect(row.is_non_releasable).toBe(true);
  });

  it("maps shot_outcome", () => {
    const row = entryToDbRow({ ...baseEntry, shotOutcome: "saved" }, GAME_ID, USER_ID);
    expect(row.shot_outcome).toBe("saved");
  });

  it("maps foul_name", () => {
    const row = entryToDbRow({ ...baseEntry, event: "penalty_tech", foulName: "Holding" }, GAME_ID, USER_ID);
    expect(row.foul_name).toBe("Holding");
  });

  it("maps shot_zone for shot location entries", () => {
    const row = entryToDbRow({ ...baseEntry, event: "shot", zone: "R2" }, GAME_ID, USER_ID);
    expect(row.shot_zone).toBe("R2");
  });

  it("sets shot_zone to null when not present", () => {
    const row = entryToDbRow(baseEntry, GAME_ID, USER_ID);
    expect(row.shot_zone).toBeNull();
  });

  it("maps is_emo true when emo flag set", () => {
    const row = entryToDbRow({ ...baseEntry, emo: true }, GAME_ID, USER_ID);
    expect(row.is_emo).toBe(true);
  });

  it("sets is_emo false when emo flag absent", () => {
    const row = entryToDbRow(baseEntry, GAME_ID, USER_ID);
    expect(row.is_emo).toBe(false);
  });

  it("includes client_created_at as an ISO string", () => {
    const row = entryToDbRow(baseEntry, GAME_ID, USER_ID);
    expect(row.client_created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
