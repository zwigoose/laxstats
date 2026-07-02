import { OrgCard } from "laxstats";
import { ADMIN_ORG, ADMIN_USERS } from "./_fixtures";

const noop = () => {};

// Admin org card — plan badge, member/team/season/game counts, actions.
export const Default = () => (
  <OrgCard org={ADMIN_ORG} users={ADMIN_USERS} onUpdated={noop} onDeleted={noop} />
);
