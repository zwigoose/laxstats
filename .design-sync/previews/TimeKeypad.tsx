import { TimeKeypad } from "laxstats";

// Game-clock entry for a 12-minute quarter.
export const Default = () => <TimeKeypad maxSeconds={720} onConfirm={() => {}} />;

// With the same-as-latest shortcut the scorekeeper sees on grouped entries.
export const SameAsLatest = () => (
  <TimeKeypad maxSeconds={720} onConfirm={() => {}} showSameAsLatest latestLabel="10:42" />
);
