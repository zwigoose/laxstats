import { describe, it, expect, vi } from "vitest";
import {
  fetchGame, fetchGameMeta, updateGame, deleteGame,
  fetchOrgContext, createScorekeeperInvite, claimScorekeeperInvite,
  deleteAllGameEvents,
} from "./games";

// ── Fake DB builder ────────────────────────────────────────────────────────────
// Returns a fluent chain that resolves to `result` at the terminal call.

function fakeChain(result) {
  const chain = {
    from:   vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    is:     vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockResolvedValue(result),
    insert: vi.fn().mockReturnThis(),
    order:  vi.fn().mockResolvedValue(result),
    rpc:    vi.fn().mockResolvedValue(result),
  };
  // update/delete chains: terminal call is the chain itself resolved
  chain.update.mockReturnValue({ ...chain, then: (fn) => Promise.resolve(result).then(fn) });
  chain.delete.mockReturnValue({ ...chain, then: (fn) => Promise.resolve(result).then(fn) });
  return chain;
}

function fakeDb(result = { data: null, error: null }) {
  const chain = fakeChain(result);
  return {
    from: vi.fn().mockReturnValue(chain),
    rpc:  vi.fn().mockResolvedValue(result),
    _chain: chain,
  };
}

// ── fetchGame ──────────────────────────────────────────────────────────────────

describe("fetchGame", () => {
  it("queries the games table by id", async () => {
    const db = fakeDb({ data: { id: "g1" }, error: null });
    await fetchGame("g1", db);
    expect(db.from).toHaveBeenCalledWith("games");
    expect(db._chain.eq).toHaveBeenCalledWith("id", "g1");
    expect(db._chain.single).toHaveBeenCalled();
  });

  it("returns data from the DB response", async () => {
    const game = { id: "g1", name: "Home vs Away", schema_ver: 2 };
    const db = fakeDb({ data: game, error: null });
    const result = await fetchGame("g1", db);
    expect(result.data).toEqual(game);
  });

  it("propagates errors", async () => {
    const db = fakeDb({ data: null, error: { message: "not found" } });
    const result = await fetchGame("missing", db);
    expect(result.error.message).toBe("not found");
  });
});

// ── fetchGameMeta ──────────────────────────────────────────────────────────────

describe("fetchGameMeta", () => {
  it("selects only state and name columns", async () => {
    const db = fakeDb({ data: { state: {}, name: "Test" }, error: null });
    await fetchGameMeta("g1", db);
    expect(db._chain.select).toHaveBeenCalledWith("state, name");
    expect(db._chain.eq).toHaveBeenCalledWith("id", "g1");
  });
});

// ── updateGame ─────────────────────────────────────────────────────────────────

describe("updateGame", () => {
  it("calls update on the games table with the correct id", async () => {
    const db = fakeDb({ error: null });
    const payload = { state: { gameOver: true } };
    await updateGame("g1", payload, db);
    expect(db.from).toHaveBeenCalledWith("games");
    expect(db._chain.update).toHaveBeenCalledWith(payload);
    expect(db._chain.eq).toHaveBeenCalledWith("id", "g1");
  });
});

// ── deleteGame ─────────────────────────────────────────────────────────────────

describe("deleteGame", () => {
  it("calls delete on the games table filtered by id", async () => {
    const db = fakeDb({ error: null });
    await deleteGame("g1", db);
    expect(db.from).toHaveBeenCalledWith("games");
    expect(db._chain.delete).toHaveBeenCalled();
    expect(db._chain.eq).toHaveBeenCalledWith("id", "g1");
  });
});

// ── fetchOrgContext ────────────────────────────────────────────────────────────

describe("fetchOrgContext", () => {
  it("fetches org name and returns orgId", async () => {
    const chain = fakeChain({ data: { name: "Westfield LAX" }, error: null });
    const db = { from: vi.fn().mockReturnValue(chain), _chain: chain };
    const result = await fetchOrgContext("org-1", null, db);
    expect(result.orgId).toBe("org-1");
    expect(result.orgName).toBe("Westfield LAX");
  });

  it("returns null seasonName when seasonId is null", async () => {
    const chain = fakeChain({ data: { name: "Org" }, error: null });
    const db = { from: vi.fn().mockReturnValue(chain), _chain: chain };
    const result = await fetchOrgContext("org-1", null, db);
    expect(result.seasonName).toBeNull();
  });

  it("fetches season name when seasonId is provided", async () => {
    let callCount = 0;
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({ data: { name: callCount === 1 ? "Org" : "Spring 2026" }, error: null });
      }),
    };
    const db = { from: vi.fn().mockReturnValue(chain) };
    const result = await fetchOrgContext("org-1", "season-1", db);
    expect(result.seasonName).toBe("Spring 2026");
  });

  it("returns null orgName on DB error", async () => {
    const chain = fakeChain({ data: null, error: { message: "not found" } });
    const db = { from: vi.fn().mockReturnValue(chain) };
    const result = await fetchOrgContext("org-1", null, db);
    expect(result.orgName).toBeNull();
  });
});

// ── createScorekeeperInvite ────────────────────────────────────────────────────

describe("createScorekeeperInvite", () => {
  it("calls the create_scorekeeper_invite RPC with the game id", async () => {
    const db = fakeDb({ data: "tok-abc", error: null });
    const result = await createScorekeeperInvite("g1", db);
    expect(db.rpc).toHaveBeenCalledWith("create_scorekeeper_invite", { p_game_id: "g1" });
    expect(result.data).toBe("tok-abc");
  });
});

// ── claimScorekeeperInvite ─────────────────────────────────────────────────────

describe("claimScorekeeperInvite", () => {
  it("calls the claim_scorekeeper_invite RPC with the token", async () => {
    const db = fakeDb({ data: null, error: null });
    await claimScorekeeperInvite("tok-abc", db);
    expect(db.rpc).toHaveBeenCalledWith("claim_scorekeeper_invite", { p_token: "tok-abc" });
  });
});

// ── deleteAllGameEvents ────────────────────────────────────────────────────────

describe("deleteAllGameEvents", () => {
  it("updates game_events with deleted_at and deleted_by", async () => {
    const db = fakeDb({ error: null });
    await deleteAllGameEvents("g1", "user-1", db);
    expect(db.from).toHaveBeenCalledWith("game_events");
    expect(db._chain.update).toHaveBeenCalledWith(expect.objectContaining({
      deleted_by: "user-1",
      deleted_at: expect.any(String),
    }));
    expect(db._chain.eq).toHaveBeenCalledWith("game_id", "g1");
  });
});
