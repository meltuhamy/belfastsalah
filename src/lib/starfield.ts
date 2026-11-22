/**
 * The Sky theme's night sky: a scatter of stars for the countdown card, made
 * afresh every time the card appears, so the sky is never the same twice.
 *
 * The stars cover a square field centred on a pivot at the middle of the
 * card's top edge, and the card turns the field slowly about that pivot, as
 * the sky turns about the pole. The field is large enough that the card stays
 * covered at every angle of the turn.
 */

export type Star = {
  /** Position in the field, in px from its top left. */
  x: number;
  y: number;
  /** Radius in px. */
  r: number;
  /** Brightness, 0 to 1. */
  a: number;
};

export type Starfield = {
  /** The field's side, in px. */
  side: number;
  /** Faint stars, drawn once. */
  faint: Star[];
  /** The few bright ones, which twinkle; each has its own phase, 0 to 1. */
  bright: Array<Star & { phase: number }>;
  /** Where the slow turn starts, in degrees, so it opens on a different sky. */
  startAngle: number;
};

/** Faint stars per px², about forty-five on a phone-sized card. */
const FAINT_DENSITY = 45 / (360 * 236);
/** Bright stars per px², about six on a phone-sized card. */
const BRIGHT_DENSITY = 6 / (360 * 236);

/**
 * The side of a field that keeps a width × height card covered while turning
 * about the middle of its top edge: twice the distance to a bottom corner.
 */
export function fieldSide(width: number, height: number): number {
  return Math.ceil(2 * Math.hypot(width / 2, height)) + 8;
}

/** A new sky for a card of this size. `random` is Math.random in the app. */
export function makeStarfield(
  width: number,
  height: number,
  random: () => number = Math.random
): Starfield {
  const side = fieldSide(width, height);
  const area = side * side;

  const faint = Array.from({ length: Math.round(area * FAINT_DENSITY) }, () => {
    const u = random();
    return {
      x: random() * side,
      y: random() * side,
      // Mostly pinpricks, a few slightly larger.
      r: u < 0.6 ? 0.45 : u < 0.9 ? 0.6 : 0.75,
      a: 0.35 + random() * 0.5,
    };
  });

  const bright = Array.from(
    { length: Math.round(area * BRIGHT_DENSITY) },
    () => ({
      x: random() * side,
      y: random() * side,
      r: 0.9 + random() * 0.25,
      a: 0.8 + random() * 0.2,
      phase: random(),
    })
  );

  return { side, faint, bright, startAngle: random() * 360 };
}
