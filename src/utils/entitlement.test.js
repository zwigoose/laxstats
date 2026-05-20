import { describe, it, expect } from "vitest";
import { entitlementMsg } from "./entitlement";

describe("entitlementMsg", () => {
  it("returns the message unchanged when it is not a known prefix", () => {
    expect(entitlementMsg("Something went wrong")).toBe("Something went wrong");
  });

  it("returns null/undefined unchanged", () => {
    expect(entitlementMsg(null)).toBeNull();
    expect(entitlementMsg(undefined)).toBeUndefined();
  });

  it("formats plan_limit_exceeded with a known feature label", () => {
    expect(entitlementMsg("plan_limit_exceeded:personal_games:3:3"))
      .toBe("Plan limit reached: 3 of 3 personal games used. Upgrade your plan to add more.");
  });

  it("formats plan_limit_exceeded for org_active_seasons", () => {
    expect(entitlementMsg("plan_limit_exceeded:org_active_seasons:1:1"))
      .toBe("Plan limit reached: 1 of 1 active seasons used. Upgrade your plan to add more.");
  });

  it("formats plan_limit_exceeded for org_active_teams", () => {
    expect(entitlementMsg("plan_limit_exceeded:org_active_teams:5:5"))
      .toBe("Plan limit reached: 5 of 5 active teams used. Upgrade your plan to add more.");
  });

  it("formats plan_limit_exceeded for org_members", () => {
    expect(entitlementMsg("plan_limit_exceeded:org_members:10:10"))
      .toBe("Plan limit reached: 10 of 10 members used. Upgrade your plan to add more.");
  });

  it("formats plan_limit_exceeded for org_games_per_season", () => {
    expect(entitlementMsg("plan_limit_exceeded:org_games_per_season:20:20"))
      .toBe("Plan limit reached: 20 of 20 games this season used. Upgrade your plan to add more.");
  });

  it("formats plan_limit_exceeded for org_member_personal_games", () => {
    expect(entitlementMsg("plan_limit_exceeded:org_member_personal_games:2:5"))
      .toBe("Plan limit reached: 2 of 5 personal games used. Upgrade your plan to add more.");
  });

  it("falls back to the raw feature id for unknown feature keys", () => {
    expect(entitlementMsg("plan_limit_exceeded:unknown_feature:1:3"))
      .toBe("Plan limit reached: 1 of 3 unknown_feature used. Upgrade your plan to add more.");
  });

  it("formats user_already_in_org with the org name", () => {
    expect(entitlementMsg("user_already_in_org:Lax United"))
      .toBe('This user is already a member of "Lax United". Users can only belong to one org.');
  });

  it("formats user_already_in_org with a colon in the org name (takes first segment only)", () => {
    const result = entitlementMsg("user_already_in_org:My Org");
    expect(result).toContain('"My Org"');
  });
});
