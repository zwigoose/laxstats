import { describe, it, expect, vi } from "vitest";
import { fetchSavedTeams } from "./teams";

describe("fetchSavedTeams", () => {
  it("queries saved_teams with correct columns ordered by name", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const db = { from: vi.fn().mockReturnValue(chain) };
    await fetchSavedTeams(db);
    expect(db.from).toHaveBeenCalledWith("saved_teams");
    expect(chain.select).toHaveBeenCalledWith("id, name, roster, color, user_id");
    expect(chain.order).toHaveBeenCalledWith("name");
  });

  it("returns team rows from the DB", async () => {
    const teams = [
      { id: "t1", name: "Westfield", roster: "", color: "#1a6bab", user_id: "u1" },
      { id: "t2", name: "Summit",    roster: "", color: "#b84e1a", user_id: "u1" },
    ];
    const chain = {
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue({ data: teams, error: null }),
    };
    const db = { from: vi.fn().mockReturnValue(chain) };
    const result = await fetchSavedTeams(db);
    expect(result.data).toEqual(teams);
  });

  it("propagates DB errors", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue({ data: null, error: { message: "permission denied" } }),
    };
    const db = { from: vi.fn().mockReturnValue(chain) };
    const result = await fetchSavedTeams(db);
    expect(result.error.message).toBe("permission denied");
  });
});
