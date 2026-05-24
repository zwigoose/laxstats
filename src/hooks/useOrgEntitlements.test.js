import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useOrgEntitlements } from "./useOrgEntitlements";

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/supabase", () => ({
  supabase: { rpc: rpcMock },
}));

beforeEach(() => {
  vi.clearAllMocks();
  rpcMock.mockResolvedValue({ data: [] });
});

describe("useOrgEntitlements", () => {
  it("returns empty entitlements and loading=false when orgId is null", async () => {
    const { result } = renderHook(() => useOrgEntitlements(null));
    expect(result.current.entitlements).toEqual({});
    expect(result.current.loading).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls org_entitlement_summary RPC with the orgId", async () => {
    renderHook(() => useOrgEntitlements("org-1"));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("org_entitlement_summary", { p_org_id: "org-1" }));
  });

  it("maps rows into a keyed object by feature_id", async () => {
    rpcMock.mockResolvedValue({
      data: [
        { feature_id: "personal_games",   current_usage: "2", plan_limit: 3 },
        { feature_id: "org_active_teams",  current_usage: "1", plan_limit: 5 },
      ],
    });
    const { result } = renderHook(() => useOrgEntitlements("org-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entitlements["personal_games"].current_usage).toBe(2);
    expect(result.current.entitlements["org_active_teams"].plan_limit).toBe(5);
  });

  it("coerces current_usage to a number", async () => {
    rpcMock.mockResolvedValue({
      data: [{ feature_id: "org_members", current_usage: "7", plan_limit: 10 }],
    });
    const { result } = renderHook(() => useOrgEntitlements("org-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.entitlements["org_members"].current_usage).toBe("number");
  });

  it("handles null RPC data gracefully", async () => {
    rpcMock.mockResolvedValue({ data: null });
    const { result } = renderHook(() => useOrgEntitlements("org-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entitlements).toEqual({});
  });

  it("re-fetches when orgId changes", async () => {
    const { rerender } = renderHook(({ id }) => useOrgEntitlements(id), {
      initialProps: { id: "org-1" },
    });
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    rerender({ id: "org-2" });
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
    expect(rpcMock).toHaveBeenLastCalledWith("org_entitlement_summary", { p_org_id: "org-2" });
  });
});
