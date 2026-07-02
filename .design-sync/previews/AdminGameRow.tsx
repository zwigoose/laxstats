import { AdminGameRow } from "laxstats";
import { GAME_FINAL, GAME_LIVE, ADMIN_USERS, ADMIN_USER_MAP } from "./_fixtures";

const noop = () => {};

// Completed game row with owner email and admin actions.
export const FinalGame = () => (
  <AdminGameRow game={GAME_FINAL} userMap={ADMIN_USER_MAP} users={ADMIN_USERS} onReassigned={noop} onDeleted={noop} />
);

// Live game row.
export const LiveGame = () => (
  <AdminGameRow game={GAME_LIVE} userMap={ADMIN_USER_MAP} users={ADMIN_USERS} onReassigned={noop} onDeleted={noop} />
);
