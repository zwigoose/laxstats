import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePersonalGameUsage } from "./usePersonalGameUsage";

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/supabase", () => ({
  supabase: { rpc: rpcMock },
}));

beforeEach(() => {
  vi.clearAllMocks();
  rpcMock.mockResolvedValue({ data: null });
});

describe("usePersonalGameUsage", () => {
  it("returns null and does not call RPC when user is null", () => {
    const { result } = renderHook(() => usePersonalGameUsage(null));
    expect(result.current).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls personal_game_usage RPC when user is provided", async () => {
    renderHook(() => usePersonalGameUsage({ id: "user-1" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("personal_game_usage"));
  });

  it("returns the first row from RPC data", async () => {
    const row = { active_games: 2, game_limit: 3 };
    rpcMock.mockResolvedValue({ data: [row] });
    const { result } = renderHook(() => usePersonalGameUsage({ id: "user-1" }));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual(row);
  });

  it("returns null when RPC data is empty", async () => {
    rpcMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => usePersonalGameUsage({ id: "user-1" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it("returns null when RPC data is null", async () => {
    rpcMock.mockResolvedValue({ data: null });
    const { result } = renderHook(() => usePersonalGameUsage({ id: "user-1" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it("re-fetches when user.id changes", async () => {
    const { rerender } = renderHook(({ user }) => usePersonalGameUsage(user), {
      initialProps: { user: { id: "user-1" } },
    });
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    rerender({ user: { id: "user-2" } });
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
  });

  it("resets to null when user becomes null", async () => {
    const { result, rerender } = renderHook(({ user }) => usePersonalGameUsage(user), {
      initialProps: { user: { id: "user-1" } },
    });
    rerender({ user: null });
    expect(result.current).toBeNull();
  });
});
