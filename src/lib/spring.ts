/**
 * A damped spring, for the Sky theme's stars: each depth layer follows the
 * phone's tilt on a spring of its own, so the layers lag, overshoot a touch
 * and settle at slightly different moments - which is what makes them read
 * as being at different depths.
 *
 * Small enough to own rather than bring in an animation library for: one
 * position and one velocity per axis, stepped once a frame.
 */

export type Spring = {
  /** How hard it pulls towards the target. Higher settles sooner. */
  stiffness: number;
  /**
   * 1 settles without overshooting; below 1 overshoots and swings back,
   * a little more the lower it is.
   */
  dampingRatio: number;
};

export type SpringState = { position: number; velocity: number };

/** The longest step taken at once, so a dropped frame cannot blow it up. */
const MAX_STEP = 1 / 30;

/**
 * Where the spring is `seconds` later, moving towards `target`. Integrated in
 * small steps (semi-implicit Euler), which stays stable at frame rates.
 */
export function stepSpring(
  state: SpringState,
  target: number,
  spring: Spring,
  seconds: number
): SpringState {
  const damping = 2 * spring.dampingRatio * Math.sqrt(spring.stiffness);
  let { position, velocity } = state;
  let left = Math.max(0, seconds);
  while (left > 0) {
    const dt = Math.min(left, MAX_STEP);
    const force = -spring.stiffness * (position - target) - damping * velocity;
    velocity += force * dt;
    position += velocity * dt;
    left -= dt;
  }
  return { position, velocity };
}

/** Whether it has come to rest at the target, near enough to stop stepping. */
export function isSettled(state: SpringState, target: number): boolean {
  return Math.abs(state.position - target) < 0.01 && Math.abs(state.velocity) < 0.01;
}
