import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MomentumTracker from "./MomentumTracker";

const teams = [{ name: "Hawks" }, { name: "Owls" }];
const teamColors = ["#1a6bab", "#b84e1a"];

describe("MomentumTracker", () => {
  it("renders the empty state with a flat neutral line before any events", () => {
    const { container } = render(
      <MomentumTracker log={[]} teams={teams} teamColors={teamColors} currentQuarter={1} />
    );
    expect(screen.getByText("Momentum")).toBeInTheDocument();
    expect(screen.getByText(/Builds as the game is scored/)).toBeInTheDocument();
    expect(container.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("labels the axis extremes with the team names, not raw numbers", () => {
    render(<MomentumTracker log={[]} teams={teams} teamColors={teamColors} />);
    expect(screen.getByText(/Hawks controlling/)).toBeInTheDocument();
    expect(screen.getByText(/Owls controlling/)).toBeInTheDocument();
  });

  it("shows quarter markers", () => {
    render(<MomentumTracker log={[]} teams={teams} teamColors={teamColors} />);
    ["Q1", "Q2", "Q3", "Q4"].forEach(q => expect(screen.getByText(q)).toBeInTheDocument());
  });

  it("renders a series when events exist", () => {
    const log = [
      { id: 1, seq: 1, groupId: "g1", teamIdx: 0, event: "goal", player: { num: "4", name: "Smith" }, quarter: 1 },
      { id: 2, seq: 2, groupId: "g2", teamIdx: 1, event: "shot", player: { num: "11", name: "Jones" }, quarter: 2 },
    ];
    const { container } = render(
      <MomentumTracker log={log} teams={teams} teamColors={teamColors} currentQuarter={2} />
    );
    expect(screen.queryByText(/Builds as the game is scored/)).not.toBeInTheDocument();
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(2); // same line clipped into home/away halves
  });
});
