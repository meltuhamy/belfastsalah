/**
 * Turns the phone's tilt into a small offset for the Sky theme's stars, so the
 * night sky shifts a few pixels as the phone is tipped - as though it sat a
 * little way behind the glass.
 *
 * Relative, not absolute: the offset is measured from a resting angle that
 * follows the phone slowly. Slowly enough that a tilt is kept - the stars stay
 * where it moved them - but whatever angle the phone is then held at drifts
 * back to being the centre over half a minute or so, so lying down does not
 * leave the sky pushed to one side.
 */

export type Tilt = { x: number; y: number };

/** Degrees of tilt that move the stars the whole way. */
const FULL_TILT = 25;
/**
 * How long, in seconds, the resting angle takes to close most (63%) of the gap
 * to the angle the phone is held at. By time, not per reading: phones send
 * readings at very different rates.
 */
const REST_SECONDS = 25;

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/**
 * A follower for one run of readings. Feed it each deviceorientation reading's
 * `beta` (front-back, degrees) and `gamma` (left-right, degrees); it returns
 * the offset in px, at most `maxPx` either way, and `now`, the reading's time
 * in ms. The stars move against the tilt, as something far away would.
 */
export function createTiltFollower(maxPx: number) {
  let rest: { beta: number; gamma: number } | null = null;
  let last = 0;
  return (beta: number | null, gamma: number | null, now: number): Tilt => {
    if (beta == null || gamma == null) return { x: 0, y: 0 };
    if (rest == null) {
      rest = { beta, gamma };
      last = now;
    }
    const dBeta = beta - rest.beta;
    const dGamma = gamma - rest.gamma;
    const follow = 1 - Math.exp(-Math.max(0, now - last) / 1000 / REST_SECONDS);
    last = now;
    rest = {
      beta: rest.beta + dBeta * follow,
      gamma: rest.gamma + dGamma * follow,
    };
    return {
      x: (-clamp(dGamma, FULL_TILT) / FULL_TILT) * maxPx,
      y: (-clamp(dBeta, FULL_TILT) / FULL_TILT) * maxPx,
    };
  };
}
