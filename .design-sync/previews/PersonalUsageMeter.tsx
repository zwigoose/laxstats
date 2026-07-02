import { PersonalUsageMeter } from "laxstats";
import { USAGE, USAGE_AT_LIMIT } from "./_fixtures";

// Under the plan limit — progress bar.
export const UnderLimit = () => <PersonalUsageMeter usage={USAGE} />;

// At the limit — red state with upgrade hint.
export const AtLimit = () => <PersonalUsageMeter usage={USAGE_AT_LIMIT} />;

// Unlimited plan — count only, no bar.
export const Unlimited = () => <PersonalUsageMeter usage={{ current_count: 38, game_limit: null, at_limit: false }} />;
