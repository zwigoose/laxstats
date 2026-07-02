import { OwnerSelect } from "laxstats";
import { ADMIN_USERS } from "./_fixtures";

// Reassign-owner dropdown from the admin game tools.
export const Default = () => (
  <OwnerSelect currentUserId="user-fixture-1" users={ADMIN_USERS} onSave={async () => {}} />
);
