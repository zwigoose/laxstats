import { OrgGameGroup } from "laxstats";
import { GAME_FINAL, GAME_LIVE, ADMIN_USERS, ADMIN_USER_MAP } from "./_fixtures";

const noop = () => {};

// Org-grouped games in the admin all-games view.
export const Default = () => (
  <OrgGameGroup
    orgName="Notre Dame Prep"
    orgSlug="notre-dame-prep"
    games={[GAME_LIVE, GAME_FINAL]}
    userMap={ADMIN_USER_MAP}
    users={ADMIN_USERS}
    onReassigned={noop}
    onDeleted={noop}
  />
);
