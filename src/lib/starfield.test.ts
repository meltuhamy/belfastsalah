import { describe, expect, it } from "vitest";
import { fieldSide, makeStarfield, TILT_SHIFT } from "./starfield";

/** A small seeded generator, so a run can be repeated. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("fieldSide", () => {
  it("Should keep every corner of the card inside the field at any angle and tilt", () => {
    for (const [w, h] of [
      [288, 236],
      [358, 236],
      [608, 260],
    ]) {
      // Less the room the tilt can shift the field by.
      const half = fieldSide(w, h) / 2 - TILT_SHIFT;
      // The pivot is the middle of the top edge; the bottom corners are the
      // card's furthest points from it.
      expect(Math.hypot(w / 2, h)).toBeLessThanOrEqual(half);
    }
  });
});

describe("makeStarfield", () => {
  it("Should scatter stars over the whole field", () => {
    const sky = makeStarfield(358, 236, seeded(1));
    for (const star of [...sky.faint, ...sky.bright]) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(sky.side);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(sky.side);
      expect(star.a).toBeGreaterThan(0);
      expect(star.a).toBeLessThanOrEqual(1);
    }
    expect(sky.startAngle).toBeGreaterThanOrEqual(0);
    expect(sky.startAngle).toBeLessThan(360);
  });

  it("Should sow the same density of stars whatever the card's size", () => {
    // About forty-five on a phone's card; more on a tablet's, not sparser.
    for (const [w, h] of [
      [358, 236],
      [608, 260],
    ]) {
      const sky = makeStarfield(w, h, seeded(2));
      const onCard = (sky.faint.length * (w * h)) / (sky.side * sky.side);
      const expected = (45 * (w * h)) / (360 * 236);
      expect(onCard).toBeGreaterThan(expected * 0.9);
      expect(onCard).toBeLessThan(expected * 1.1);
    }
  });

  it("Should make a different sky each time", () => {
    const a = makeStarfield(358, 236);
    const b = makeStarfield(358, 236);
    expect(a.faint[0]).not.toEqual(b.faint[0]);
  });
});
