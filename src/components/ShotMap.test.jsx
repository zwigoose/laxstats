import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ShotMap from "./ShotMap";

const teams = [{ name: "Home" }, { name: "Away" }];
const teamColors = ["#1a6bab", "#b84e1a"];

function zoneText(content) {
  return screen.getByText((_, el) => el.tagName === "text" && el.textContent === content);
}

describe("ShotMap zone aggregates", () => {
  it("counts a goal's shot+goal entry pair as one attempt, one goal", () => {
    // A goal is committed as a shot entry + goal entry sharing one groupId,
    // both stamped with the same zone.
    const log = [
      { id: 1, groupId: "g1", teamIdx: 0, event: "shot", zone: "C1", player: { num: "1", name: "A" } },
      { id: 2, groupId: "g1", teamIdx: 0, event: "goal", zone: "C1", player: { num: "1", name: "A" } },
      { id: 3, groupId: "g2", teamIdx: 0, event: "shot", zone: "C1", player: { num: "2", name: "B" } },
    ];
    render(<ShotMap log={log} teams={teams} teamColors={teamColors} />);
    // 2 attempts (1 goal + 1 miss), not 3 entries
    expect(zoneText("2-1 · 50%")).toBeInTheDocument();
  });

  it("a lone goal shows 1-1 · 100% in its zone", () => {
    const log = [
      { id: 1, groupId: "g1", teamIdx: 0, event: "shot", zone: "R1", player: { num: "1", name: "A" } },
      { id: 2, groupId: "g1", teamIdx: 0, event: "goal", zone: "R1", player: { num: "1", name: "A" } },
    ];
    render(<ShotMap log={log} teams={teams} teamColors={teamColors} />);
    expect(zoneText("1-1 · 100%")).toBeInTheDocument();
  });

  it("buckets legacy x/y entries on the fly and dedupes their goal pairs too", () => {
    const y = 70 / 110; // close band
    const log = [
      { id: 1, groupId: "g1", teamIdx: 0, event: "shot", shotX: 0.1, shotY: y, player: { num: "1", name: "A" } }, // L1
      { id: 2, groupId: "g1", teamIdx: 0, event: "goal", shotX: 0.1, shotY: y, player: { num: "1", name: "A" } },
    ];
    render(<ShotMap log={log} teams={teams} teamColors={teamColors} />);
    expect(zoneText("1-1 · 100%")).toBeInTheDocument();
  });

  it("ignores entries without a zone", () => {
    const log = [
      { id: 1, groupId: "g1", teamIdx: 0, event: "shot", player: { num: "1", name: "A" } },
    ];
    render(<ShotMap log={log} teams={teams} teamColors={teamColors} />);
    expect(screen.getByText(/No shot locations recorded yet/)).toBeInTheDocument();
  });
});
