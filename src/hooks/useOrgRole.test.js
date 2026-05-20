import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useOrgRole } from "./useOrgRole";

const authState = vi.hoisted(() => ({
  getOrgRole: vi.fn().mockReturnValue(null),
  isPlatformAdmin: false,
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ ...authState }),
}));

function render(orgId) {
  return renderHook(() => useOrgRole(orgId)).result.current;
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isPlatformAdmin = false;
  authState.getOrgRole.mockReturnValue(null);
});

describe("useOrgRole — no membership", () => {
  it("returns null role when user is not a member", () => {
    const r = render("org-1");
    expect(r.role).toBeNull();
  });

  it("returns null role when orgId is falsy", () => {
    const r = render(null);
    expect(r.role).toBeNull();
    expect(authState.getOrgRole).not.toHaveBeenCalled();
  });

  it("all permission flags are false for non-members", () => {
    const r = render("org-1");
    expect(r.isOrgAdmin).toBe(false);
    expect(r.isCoach).toBe(false);
    expect(r.canScore).toBe(false);
    expect(r.canView).toBe(false);
  });
});

describe("useOrgRole — viewer", () => {
  beforeEach(() => authState.getOrgRole.mockReturnValue("viewer"));

  it("canView is true", () => expect(render("org-1").canView).toBe(true));
  it("canScore is false", () => expect(render("org-1").canScore).toBe(false));
  it("isCoach is false", () => expect(render("org-1").isCoach).toBe(false));
  it("isOrgAdmin is false", () => expect(render("org-1").isOrgAdmin).toBe(false));
});

describe("useOrgRole — scorekeeper", () => {
  beforeEach(() => authState.getOrgRole.mockReturnValue("scorekeeper"));

  it("canView and canScore are true", () => {
    const r = render("org-1");
    expect(r.canView).toBe(true);
    expect(r.canScore).toBe(true);
  });
  it("isCoach is false", () => expect(render("org-1").isCoach).toBe(false));
  it("isOrgAdmin is false", () => expect(render("org-1").isOrgAdmin).toBe(false));
});

describe("useOrgRole — coach", () => {
  beforeEach(() => authState.getOrgRole.mockReturnValue("coach"));

  it("canView, canScore, and isCoach are true", () => {
    const r = render("org-1");
    expect(r.canView).toBe(true);
    expect(r.canScore).toBe(true);
    expect(r.isCoach).toBe(true);
  });
  it("isOrgAdmin is false", () => expect(render("org-1").isOrgAdmin).toBe(false));
});

describe("useOrgRole — org_admin", () => {
  beforeEach(() => authState.getOrgRole.mockReturnValue("org_admin"));

  it("all permission flags are true", () => {
    const r = render("org-1");
    expect(r.canView).toBe(true);
    expect(r.canScore).toBe(true);
    expect(r.isCoach).toBe(true);
    expect(r.isOrgAdmin).toBe(true);
  });
});

describe("useOrgRole — platform admin", () => {
  beforeEach(() => {
    authState.isPlatformAdmin = true;
    authState.getOrgRole.mockReturnValue(null);
  });

  it("all permission flags are true regardless of org membership", () => {
    const r = render("org-1");
    expect(r.canView).toBe(true);
    expect(r.canScore).toBe(true);
    expect(r.isCoach).toBe(true);
    expect(r.isOrgAdmin).toBe(true);
  });

  it("isPlatformAdmin is exposed", () => {
    expect(render("org-1").isPlatformAdmin).toBe(true);
  });
});
