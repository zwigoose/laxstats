import { Admin } from "laxstats";

// Platform-admin console shell — dark header, tab bar (All Games / Users /
// Rosters / Orgs / Plans). Tab bodies load from the network in the app;
// outside it they settle into their fetch-error states, so this card shows
// the console chrome.
export const Default = () => <Admin />;
