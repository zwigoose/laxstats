import { NumberKeypad } from "laxstats";

// Jersey-number entry pad from the scorekeeper flow.
export const Default = () => <NumberKeypad onConfirm={() => {}} onCancel={() => {}} />;

// Validation error state.
export const WithError = () => (
  <NumberKeypad onConfirm={() => {}} onCancel={() => {}} error="No #42 on the roster" />
);
