/**
 * Turns the phone's tilt into a small offset for the Sky theme's stars, so the
 * night sky shifts a few pixels as the phone is tipped - as though it sat a
 * little way behind the glass.
 *
 * Relative, not absolute: the offset is measured from a resting angle that
 * follows the phone, so whatever angle it is held at soon becomes the centre
 * again and only the movement shows.
 *
 * Measured on which way is up, not on `beta` and `gamma` themselves. Those
 * are Euler angles, and they flip: held near upright, a phone's `gamma` jumps
 * by up to 180 degrees between two readings while the phone barely moves, and
 * `beta` wraps at 180. Taken as they came, that threw the stars the whole way
 * across in a frame now and then (MEL-352). The direction of up, worked out
 * from the two, moves only as far as the phone does.
 */

export type Tilt = { x: number; y: number };

type Vector = { x: number; y: number; z: number };

const DEGREES = Math.PI / 180;

/** Degrees of tilt that move the stars the whole way. */
const FULL_TILT = 25;
const FULL = Math.sin(FULL_TILT * DEGREES);

/**
 * How long, in seconds, the resting angle takes to close most (63%) of the gap
 * to the angle the phone is held at - the pace the first version of this had
 * at 60 readings a second. By time, not per reading: phones send readings at
 * very different rates.
 */
const REST_SECONDS = 0.8;

/**
 * How long, in seconds, what is drawn takes to close most (63%) of the gap to
 * the tilt.
 */
export const EASE_SECONDS = 0.25;

/**
 * The fastest what is drawn may move, in whole offsets (-1 to 1) a second:
 * the near stars, which move 10px at most, at most 8px a second. A flick of
 * the wrist then glides instead of jumping.
 */
export const MAX_SPEED = 0.8;

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/**
 * Up, in the phone's own axes - x to the right of the screen, y to its top, z
 * out of it - for a deviceorientation reading's `beta` and `gamma`. Flat on a
 * table that is (0, 0, 1); upright in front of you, (0, 1, 0).
 */
export function upFor(beta: number, gamma: number): Vector {
  const b = beta * DEGREES;
  const g = gamma * DEGREES;
  return {
    x: -Math.sin(g) * Math.cos(b),
    y: Math.sin(b),
    z: Math.cos(b) * Math.cos(g),
  };
}

function normalise(v: Vector): Vector {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/**
 * A follower for one run of readings. Feed it each deviceorientation reading's
 * `beta` (front-back, degrees) and `gamma` (left-right, degrees); it returns
 * the offset in px, at most `maxPx` either way, and `now`, the reading's time
 * in ms. The stars move against the tilt, as something far away would.
 */
export function createTiltFollower(maxPx: number) {
  let rest: Vector | null = null;
  let last = 0;
  return (beta: number | null, gamma: number | null, now: number): Tilt => {
    if (beta == null || gamma == null) return { x: 0, y: 0 };
    const up = upFor(beta, gamma);
    if (rest == null) {
      rest = up;
      last = now;
    }
    const d = { x: up.x - rest.x, y: up.y - rest.y, z: up.z - rest.z };
    const follow = 1 - Math.exp(-Math.max(0, now - last) / 1000 / REST_SECONDS);
    last = now;
    rest = normalise({
      x: rest.x + d.x * follow,
      y: rest.y + d.y * follow,
      z: rest.z + d.z * follow,
    });
    return {
      x: clamp(d.x / FULL, 1) * maxPx,
      y: clamp(-d.y / FULL, 1) * maxPx,
    };
  };
}

/**
 * Eases what is drawn towards the tilt, once a frame: feed it the latest
 * offset (-1 to 1 on each axis) and the frame's time in ms. It moves most of
 * the way in EASE_SECONDS but never faster than MAX_SPEED, and says when it
 * has arrived, so the caller can stop asking for frames until the next
 * reading.
 *
 * In place of a CSS transition, which every reading restarted from the
 * element's current position at full speed: at sixty readings a second that
 * read as a lurch at the start of each movement.
 */
export function createTiltEaser(
  seconds: number = EASE_SECONDS,
  maxSpeed: number = MAX_SPEED
) {
  let shown: Tilt = { x: 0, y: 0 };
  let last: number | null = null;
  return (target: Tilt, now: number): { tilt: Tilt; settled: boolean } => {
    // A long gap - the first frame, or one after a pause - is not a licence
    // to jump: at most a tenth of a second's movement.
    const dt = last == null ? 1 / 60 : clamp((now - last) / 1000, 0.1);
    last = now;
    const k = 1 - Math.exp(-Math.max(0, dt) / seconds);
    let sx = (target.x - shown.x) * k;
    let sy = (target.y - shown.y) * k;
    const step = Math.hypot(sx, sy);
    const cap = maxSpeed * Math.max(0, dt);
    if (step > cap) {
      sx *= cap / step;
      sy *= cap / step;
    }
    shown = { x: shown.x + sx, y: shown.y + sy };
    const settled = Math.hypot(target.x - shown.x, target.y - shown.y) < 0.002;
    if (settled) {
      shown = { x: target.x, y: target.y };
      last = null;
    }
    return { tilt: shown, settled };
  };
}
