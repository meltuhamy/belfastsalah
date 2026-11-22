import { describe, expect, it } from "vitest";
import { createTiltFollower } from "./tilt";

/** Feeds `follow` the same reading at 60 a second for `seconds`, from `start` ms. */
function hold(
  follow: ReturnType<typeof createTiltFollower>,
  beta: number,
  gamma: number,
  start: number,
  seconds: number
) {
  let offset = { x: 0, y: 0 };
  for (let t = 0; t <= seconds * 1000; t += 1000 / 60) {
    offset = follow(beta, gamma, start + t);
  }
  return offset;
}

describe("createTiltFollower", () => {
  it("Should start at the centre, whatever angle the phone is held at", () => {
    const follow = createTiltFollower(8);
    expect(follow(40, -10, 0)).toEqual({ x: -0, y: -0 });
  });

  it("Should move the stars against the tilt, a few px at most", () => {
    const follow = createTiltFollower(8);
    follow(40, 0, 0);
    const right = follow(40, 10, 16);
    expect(right.x).toBeLessThan(0);
    expect(right.y).toBeCloseTo(0);

    const far = createTiltFollower(8);
    far(0, 0, 0);
    const tipped = far(90, 90, 16);
    expect(tipped.x).toBe(-8);
    expect(tipped.y).toBe(-8);
  });

  it("Should settle back to the centre when held still at a new angle", () => {
    const follow = createTiltFollower(8);
    follow(40, 0, 0);
    const first = follow(40, 15, 16).x;
    const later = hold(follow, 40, 15, 16, 3);
    expect(Math.abs(later.x)).toBeLessThan(Math.abs(first) / 10);
  });

  it("Should drift back at the same pace whatever rate readings come at", () => {
    const fast = createTiltFollower(8);
    fast(40, 0, 0);
    const slow = createTiltFollower(8);
    slow(40, 0, 0);
    let a = { x: 0, y: 0 };
    // 60 readings a second against 20: within half a px of each other.
    for (let t = 0; t <= 600; t += 1000 / 60) a = fast(40, 15, t);
    let b = { x: 0, y: 0 };
    for (let t = 0; t <= 600; t += 50) b = slow(40, 15, t);
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.5);
  });

  it("Should stay still without readings", () => {
    const follow = createTiltFollower(8);
    expect(follow(null, null, 0)).toEqual({ x: 0, y: 0 });
  });
});
