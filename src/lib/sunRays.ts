/**
 * Duhr's rays: the slowly turning rays the Sky card's sun gets while Duhr's
 * adhan is being called (MEL-366, designed in "A softer sun", MEL-365).
 *
 * Pure, so the curve can be tested against any clock, and so the streaks are
 * the same on every render: the gradients are worked out once, here, and the
 * card hands the same strings to the same elements every second.
 */

import { ADHAN_WINDOW_MS } from "./adhanMoment";

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * How strong the rays are, `seconds` after Duhr came in: 0 outside the adhan
 * moment, about 1 while it lasts. In within about six seconds, fast at first
 * so it is noticed, with a brief swell (peaking at about 1.3, six seconds in)
 * that settles by twenty; out over the moment's last minute. Worked out from
 * the clock, so opening the app partway through shows the right strength.
 */
export function rayStrength(seconds: number): number {
  const end = ADHAN_WINDOW_MS / 1000;
  if (!(seconds >= 0 && seconds < end)) return 0;
  const rise = 1 - Math.pow(1 - Math.min(1, seconds / 6), 3);
  const swell = 0.3 * smoothstep(0, 6, seconds) * (1 - smoothstep(6, 20, seconds));
  return (rise + swell) * (1 - smoothstep(end - 60, end, seconds));
}

/** One streak: where it points and how wide, in degrees, and how bright, 0 to 1. */
type Streak = [angle: number, width: number, strength: number];

/**
 * Uneven but fixed: `n` streaks, one in each equal slice of the circle,
 * placed and sized by a seeded Park-Miller generator, as the prototype was.
 */
function scatter(
  n: number,
  seed: number,
  minW: number,
  maxW: number,
  minS: number,
  maxS: number
): Array<Streak> {
  let x = seed;
  const rnd = () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
  const out: Array<Streak> = [];
  for (let i = 0; i < n; i++) {
    const base = (360 / n) * i;
    out.push([
      base + rnd() * (360 / n) * 0.8 + 1.5,
      minW + rnd() * (maxW - minW),
      minS + rnd() * (maxS - minS),
    ]);
  }
  return out;
}

const rgba = (rgb: string, a: number) => `rgba(${rgb}, ${+a.toFixed(3)})`;

/** A ring of streaks as a conic gradient, each soft at both sides. */
function streaks(list: ReadonlyArray<Streak>, tint: string): string {
  const stops = ["transparent 0deg"];
  for (const [a, w, s] of list) {
    const soft = Math.max(0.6, w);
    stops.push(
      `transparent ${(a - soft).toFixed(2)}deg`,
      `${rgba(tint, s)} ${a.toFixed(2)}deg`,
      `${rgba(tint, s)} ${(a + w * 0.3).toFixed(2)}deg`,
      `transparent ${(a + w * 0.3 + soft).toFixed(2)}deg`
    );
  }
  stops.push("transparent 360deg");
  return `conic-gradient(from 0deg, ${stops.join(", ")})`;
}

export type RayLayer = {
  /** The layer's class modifier, which sets its size, mask, blur and turn. */
  name: "broad" | "long" | "short";
  /** Its streaks, as a whole background. */
  background: string;
  /** Its opacity at full strength; the card's is `min(1, strength * this)`. */
  opacity: number;
};

/**
 * The three layers, back to front: a few broad, soft spokes of glare; long,
 * sparse streaks that reach far; and short, fine ones close to the sun.
 */
export const RAY_LAYERS: ReadonlyArray<RayLayer> = [
  {
    name: "broad",
    background: streaks(scatter(5, 101, 5, 9, 0.18, 0.32), "255, 246, 222"),
    opacity: 0.8,
  },
  {
    name: "long",
    background: streaks(scatter(9, 7, 0.6, 1.4, 0.45, 0.9), "255, 251, 238"),
    opacity: 0.75,
  },
  {
    name: "short",
    background: streaks(scatter(24, 31, 0.4, 1.1, 0.25, 0.7), "255, 251, 238"),
    opacity: 0.7,
  },
];
