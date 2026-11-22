/**
 * Turns the phone's tilt into a small offset for the Sky theme's stars, so the
 * night sky shifts a few pixels as the phone is tipped - as though it sat a
 * little way behind the glass.
 *
 * Relative, not absolute: the offset is measured from a resting angle that
 * follows the phone slowly, so whatever angle someone holds it at becomes the
 * centre again after a few seconds, and only the movement shows.
 */

export type Tilt = { x: number; y: number };

/** Degrees of tilt that move the stars the whole way. */
const FULL_TILT = 25;
/** How much of the gap to the current angle the resting angle closes per reading. */
const REST_FOLLOW = 0.02;

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/**
 * A follower for one run of readings. Feed it each deviceorientation reading's
 * `beta` (front-back, degrees) and `gamma` (left-right, degrees); it returns
 * the offset in px, at most `maxPx` either way. The stars move against the
 * tilt, as something far away would.
 */
export function createTiltFollower(maxPx: number) {
  let rest: { beta: number; gamma: number } | null = null;
  return (beta: number | null, gamma: number | null): Tilt => {
    if (beta == null || gamma == null) return { x: 0, y: 0 };
    if (rest == null) rest = { beta, gamma };
    const dBeta = beta - rest.beta;
    const dGamma = gamma - rest.gamma;
    rest = {
      beta: rest.beta + dBeta * REST_FOLLOW,
      gamma: rest.gamma + dGamma * REST_FOLLOW,
    };
    return {
      x: (-clamp(dGamma, FULL_TILT) / FULL_TILT) * maxPx,
      y: (-clamp(dBeta, FULL_TILT) / FULL_TILT) * maxPx,
    };
  };
}
