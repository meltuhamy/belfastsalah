import { describe, expect, it } from "vitest";
import { RAY_LAYERS, rayStrength } from "./sunRays";

describe("rayStrength", () => {
  it("is nothing outside Duhr's five minutes", () => {
    expect(rayStrength(-1)).toBe(0);
    expect(rayStrength(0)).toBe(0);
    expect(rayStrength(300)).toBe(0);
    expect(rayStrength(301)).toBe(0);
    expect(rayStrength(Number.NaN)).toBe(0);
  });

  it("comes in fast, most of the way within a couple of seconds", () => {
    expect(rayStrength(1)).toBeGreaterThan(0.4);
    expect(rayStrength(2)).toBeGreaterThan(0.7);
  });

  it("swells to a peak at about six seconds, settled by twenty", () => {
    const peak = rayStrength(6);
    expect(peak).toBeCloseTo(1.3, 5);
    for (const s of [3, 5, 8, 12, 19]) expect(rayStrength(s)).toBeLessThan(peak);
    expect(rayStrength(20)).toBeCloseTo(1, 5);
    expect(rayStrength(200)).toBeCloseTo(1, 5);
  });

  it("fades out over the moment's last minute", () => {
    expect(rayStrength(240)).toBeCloseTo(1, 5);
    expect(rayStrength(270)).toBeCloseTo(0.5, 5);
    expect(rayStrength(299)).toBeLessThan(0.01);
    let last = rayStrength(240);
    for (let s = 241; s < 300; s++) {
      const r = rayStrength(s);
      expect(r).toBeLessThanOrEqual(last);
      last = r;
    }
  });
});

describe("RAY_LAYERS", () => {
  it("has the designed streak counts, the same every time", () => {
    const count = (bg: string) => (bg.match(/rgba/g) ?? []).length / 2;
    expect(RAY_LAYERS.map((l) => [l.name, count(l.background)])).toEqual([
      ["broad", 5],
      ["long", 9],
      ["short", 24],
    ]);
    expect(RAY_LAYERS.map((l) => l.opacity)).toEqual([0.8, 0.75, 0.7]);
  });
});
