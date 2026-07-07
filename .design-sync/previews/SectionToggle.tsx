import { SectionToggle } from "laxstats";

// Collapsed admin section header with count.
export const Closed = () => <SectionToggle label="Organization" count={12} open={false} onToggle={() => {}} />;

// Expanded state.
export const Open = () => <SectionToggle label="Organization" count={12} open onToggle={() => {}} />;
