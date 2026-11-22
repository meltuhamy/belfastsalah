import { describe, expect, it } from "vitest";
import { isSettled, stepSpring, SpringState } from "./spring";

function run(
  spring: { stiffness: number; dampingRatio: number },
  seconds: number,
  fps = 60
) {
  let state: SpringState = { position: 0, velocity: 0 };
  let peak = 0;
  for (let t = 0; t < seconds; t += 1 / fps) {
    state = stepSpring(state, 10, spring, 1 / fps);
    peak = Math.max(peak, state.position);
  }
  return { state, peak };
}

describe("stepSpring", () => {
  it("Should come to rest at the target", () => {
    const { state } = run({ stiffness: 90, dampingRatio: 0.65 }, 3);
    expect(isSettled(state, 10)).toBe(true);
  });

  it("Should overshoot a little when underdamped, and not at all when critically damped", () => {
    const loose = run({ stiffness: 90, dampingRatio: 0.6 }, 3);
    expect(loose.peak).toBeGreaterThan(10.5);
    expect(loose.peak).toBeLessThan(12);

    const firm = run({ stiffness: 90, dampingRatio: 1 }, 3);
    expect(firm.peak).toBeLessThanOrEqual(10.0001);
  });

  it("Should land in the same place at any frame rate, and survive a long frame", () => {
    const smooth = run({ stiffness: 90, dampingRatio: 0.65 }, 3, 120);
    const choppy = run({ stiffness: 90, dampingRatio: 0.65 }, 3, 20);
    expect(smooth.state.position).toBeCloseTo(choppy.state.position, 1);

    const stalled = stepSpring(
      { position: 0, velocity: 0 },
      10,
      { stiffness: 90, dampingRatio: 0.65 },
      2
    );
    expect(Number.isFinite(stalled.position)).toBe(true);
    expect(Math.abs(stalled.position - 10)).toBeLessThan(1);
  });

  it("Should lag behind more on a softer spring", () => {
    const stiff = run({ stiffness: 140, dampingRatio: 0.7 }, 0.1);
    const soft = run({ stiffness: 60, dampingRatio: 0.7 }, 0.1);
    expect(soft.state.position).toBeLessThan(stiff.state.position);
  });
});
