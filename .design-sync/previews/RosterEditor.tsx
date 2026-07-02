import { RosterEditor } from "laxstats";
import { TEAMS } from "./_fixtures";

const noop = async () => {};

// Editing an existing saved team — name, color swatches, roster text.
export const EditTeam = () => (
  <RosterEditor
    initial={{ name: TEAMS[0].name, color: TEAMS[0].color, roster: TEAMS[0].roster }}
    onSave={noop}
    onDelete={noop}
    onCancel={() => {}}
    isNew={false}
  />
);

// Creating a new team from scratch.
export const NewTeam = () => (
  <RosterEditor initial={null} onSave={noop} onCancel={() => {}} isNew />
);
