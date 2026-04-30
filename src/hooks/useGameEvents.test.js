import { describe, it, expect } from "vitest";
import { dbRowToEntry } from "./useGameEvents";

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
});
