import { GameList } from "laxstats";

// The home page — hero header, tabs, and section scaffolding. Game sections
// load from the network in the app; outside it they settle into their empty
// states, so this card shows the page chrome the redesign starts from.
export const HomePage = () => <GameList />;
