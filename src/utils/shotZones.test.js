import { describe, it, expect } from "vitest";
import { pointToZone, entryZone, SHOT_ZONES } from "./shotZones";

// x/y are normalized 0–1 against the 120×110 viewBox.
// Column boundaries at vx=40/80 → x=1/3 and 2/3.
// Band boundary at vy=65 → y=65/110; goal line at vy=90 → y=90/110.

describe("pointToZone", () => {
  it("returns null when coordinates are missing", () => {
    expect(pointToZone(null, null)).toBeNull();
    expect(pointToZone(undefined, undefined)).toBeNull();
    expect(pointToZone(0.5, null)).toBeNull();
  });

  it("buckets the close band (between halfway line and goal line)", () => {
    const y = 70 / 110; // vy=70 → close band
    expect(pointToZone(0.1, y)).toBe("L1");   // vx=12
    expect(pointToZone(0.5, y)).toBe("C1");   // vx=60
    expect(pointToZone(0.9, y)).toBe("R1");   // vx=108
  });

  it("buckets the far band (midfield to the halfway line)", () => {
    const y = 30 / 110; // vy=30 → far band
    expect(pointToZone(0.1, y)).toBe("L2");
    expect(pointToZone(0.5, y)).toBe("C2");
    expect(pointToZone(0.9, y)).toBe("R2");
  });

  it("treats the 50% line (vy=65) as part of the close band", () => {
    expect(pointToZone(0.5, 65 / 110)).toBe("C1");
  });

  it("clamps behind-GLE mis-taps to the close band", () => {
    expect(pointToZone(0.5, 1.0)).toBe("C1");      // vy=110, behind the goal line
    expect(pointToZone(0.05, 95 / 110)).toBe("L1"); // just behind GLE, left
  });

  it("respects column boundaries (vx 40 and 80 are center)", () => {
    const y = 70 / 110;
    expect(pointToZone(40 / 120, y)).toBe("C1");
    expect(pointToZone(80 / 120, y)).toBe("C1");
    expect(pointToZone(39 / 120, y)).toBe("L1");
    expect(pointToZone(81 / 120, y)).toBe("R1");
  });

  it("only ever returns one of the six zones", () => {
    for (let x = 0; x <= 1; x += 0.1) {
      for (let y = 0; y <= 1; y += 0.1) {
        expect(SHOT_ZONES).toContain(pointToZone(x, y));
      }
    }
  });
});

describe("entryZone", () => {
  it("prefers the stored zone", () => {
    expect(entryZone({ zone: "R2", shotX: 0.5, shotY: 0.7 })).toBe("R2");
  });

  it("falls back to bucketing legacy x/y extras", () => {
    expect(entryZone({ shotX: 0.5, shotY: 70 / 110 })).toBe("C1");
  });

  it("returns null when the entry has no location", () => {
    expect(entryZone({ event: "shot" })).toBeNull();
  });
});
