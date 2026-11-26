import { describe, expect, it } from "vitest";
import { createTiltEaser, createTiltFollower, MAX_SPEED, upFor } from "./tilt";

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
    const offset = follow(40, -10, 0);
    expect(offset.x).toBeCloseTo(0);
    expect(offset.y).toBeCloseTo(0);
  });

  it("Should move the stars against the tilt, a few px at most", () => {
    const follow = createTiltFollower(8);
    follow(40, 0, 0);
    const right = follow(40, 10, 16);
    expect(right.x).toBeLessThan(0);
    expect(right.y).toBeCloseTo(0);

    const far = createTiltFollower(8);
    far(0, 0, 0);
    const tipped = far(60, 60, 16);
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

  it("Should not jump when the angles flip as the phone passes upright", () => {
    // Held just short of upright and then just past it, a phone's readings
    // jump: gamma swings by 180 and beta folds back, though the phone has
    // barely moved. The offset must barely move either.
    const follow = createTiltFollower(10);
    follow(88, 5, 0);
    const before = follow(89, 5, 16);
    const after = follow(89, -175, 32);
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.5);
    expect(Math.abs(after.y - before.y)).toBeLessThan(0.5);
  });

  it("Should stay still without readings", () => {
    const follow = createTiltFollower(8);
    expect(follow(null, null, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe("upFor", () => {
  it("Should point out of the screen when the phone lies flat", () => {
    const up = upFor(0, 0);
    expect(up.z).toBeCloseTo(1);
  });

  it("Should point to the top of the screen when the phone stands upright", () => {
    const up = upFor(90, 0);
    expect(up.y).toBeCloseTo(1);
  });

  it("Should be the same direction either side of an angle flip", () => {
    // beta 100, gamma 0 and beta 80, gamma 180 are the same way up.
    const a = upFor(100, 0);
    const b = upFor(80, 180);
    expect(a.x).toBeCloseTo(b.x);
    expect(a.y).toBeCloseTo(b.y);
    expect(a.z).toBeCloseTo(b.z);
  });
});

describe("createTiltEaser", () => {
  it("Should glide, never faster than its top speed, even after a flick", () => {
    const ease = createTiltEaser();
    let previous = 0;
    for (let t = 0; t <= 1000; t += 1000 / 60) {
      const { tilt } = ease({ x: 1, y: 0 }, t);
      expect(tilt.x - previous).toBeLessThanOrEqual(MAX_SPEED / 60 + 1e-9);
      previous = tilt.x;
    }
  });

  it("Should arrive, and say so, when held still", () => {
    const ease = createTiltEaser();
    let result = ease({ x: 0.3, y: -0.2 }, 0);
    for (let t = 0; t <= 3000 && !result.settled; t += 1000 / 60) {
      result = ease({ x: 0.3, y: -0.2 }, t);
    }
    expect(result.settled).toBe(true);
    expect(result.tilt).toEqual({ x: 0.3, y: -0.2 });
  });

  it("Should not jump after a pause between frames", () => {
    const ease = createTiltEaser();
    ease({ x: 0, y: 0 }, 0);
    const { tilt } = ease({ x: 1, y: 0 }, 5000);
    expect(tilt.x).toBeLessThanOrEqual(MAX_SPEED * 0.1 + 1e-9);
  });
});
