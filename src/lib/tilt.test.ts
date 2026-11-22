import { describe, expect, it } from "vitest";
import { createTiltFollower } from "./tilt";

describe("createTiltFollower", () => {
  it("Should start at the centre, whatever angle the phone is held at", () => {
    const follow = createTiltFollower(8);
    expect(follow(40, -10)).toEqual({ x: -0, y: -0 });
  });

  it("Should move the stars against the tilt, a few px at most", () => {
    const follow = createTiltFollower(8);
    follow(40, 0);
    const right = follow(40, 10);
    expect(right.x).toBeLessThan(0);
    expect(right.y).toBeCloseTo(0);

    const far = createTiltFollower(8);
    far(0, 0);
    const tipped = far(90, 90);
    expect(tipped.x).toBe(-8);
    expect(tipped.y).toBe(-8);
  });

  it("Should settle back to the centre when held still at a new angle", () => {
    const follow = createTiltFollower(8);
    follow(40, 0);
    let offset = follow(40, 15);
    const first = offset.x;
    for (let i = 0; i < 400; i++) offset = follow(40, 15);
    expect(Math.abs(offset.x)).toBeLessThan(Math.abs(first) / 10);
  });

  it("Should stay still without readings", () => {
    const follow = createTiltFollower(8);
    expect(follow(null, null)).toEqual({ x: 0, y: 0 });
  });
});
