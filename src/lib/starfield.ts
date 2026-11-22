/**
 * The Sky theme's night sky: a scatter of stars for the countdown card, made
 * afresh every time the card appears, so the sky is never the same twice.
 *
 * The stars cover a square field centred on a pivot at the middle of the
 * card's top edge, and the card turns the field slowly about that pivot, as
 * the sky turns about the pole. The field is large enough that the card stays
 * covered at every angle of the turn.
 *
 * The stars sit at three depths. Tipping the phone shifts each depth by a
 * different amount, on a spring of its own (STAR_LAYERS), so the layers slide
 * past each other a little and the sky reads as deep rather than flat.
 */

import type { Spring } from "./spring";

export type Star = {
  /** Position in the field, in px from its top left. */
  x: number;
  y: number;
  /** Radius in px. */
  r: number;
  /** Brightness, 0 to 1. */
  a: number;
};

/** A star with the depth it sits at: 0, the farthest, to 2, the nearest. */
export type DepthStar = Star & { depth: 0 | 1 | 2 };

/**
 * The three depths, far to near: how many px the full tilt shifts each, and
 * the spring it follows. Soft and lightly damped, so the stars carry on past
 * where the tilt puts them and swing back before they settle, as though they
 * had some weight. The nearer the layer the further it moves and the looser
 * its spring, so it lags and swings the most; the far stars barely stir.
 */
export const STAR_LAYERS: ReadonlyArray<{ shift: number; spring: Spring }> = [
  { shift: 3, spring: { stiffness: 60, dampingRatio: 0.5 } },
  { shift: 6, spring: { stiffness: 45, dampingRatio: 0.4 } },
  { shift: 10, spring: { stiffness: 35, dampingRatio: 0.32 } },
];

export type Starfield = {
  /** The field's side, in px. */
  side: number;
  /** Faint stars, drawn once, each at a depth. */
  faint: DepthStar[];
  /**
   * The few bright ones, which twinkle; each has its own phase, 0 to 1. Always
   * the nearest, as the brightest stars would be.
   */
  bright: Array<Star & { phase: number }>;
  /** Where the slow turn starts, in degrees, so it opens on a different sky. */
  startAngle: number;
};

/** Faint stars per px², about forty-five on a phone-sized card. */
const FAINT_DENSITY = 45 / (360 * 236);
/** Bright stars per px², about six on a phone-sized card. */
const BRIGHT_DENSITY = 6 / (360 * 236);

/**
 * How far, in px, a layer may ever be from centre: the nearest layer's shift
 * and room for its spring to swing past it. Positions are held to this.
 */
export const TILT_SHIFT = 16;

/**
 * The side of a field that keeps a width × height card covered while turning
 * about the middle of its top edge - twice the distance to a bottom corner -
 * and while the tilt shifts it either way.
 */
export function fieldSide(width: number, height: number): number {
  return Math.ceil(2 * Math.hypot(width / 2, height)) + 8 + 2 * TILT_SHIFT;
}

/** A new sky for a card of this size. `random` is Math.random in the app. */
export function makeStarfield(
  width: number,
  height: number,
  random: () => number = Math.random
): Starfield {
  const side = fieldSide(width, height);
  const area = side * side;

  const faint = Array.from(
    { length: Math.round(area * FAINT_DENSITY) },
    (): DepthStar => {
      const u = random();
      return {
        x: random() * side,
        y: random() * side,
        // Mostly pinpricks, a few slightly larger.
        r: u < 0.6 ? 0.45 : u < 0.9 ? 0.6 : 0.75,
        a: 0.35 + random() * 0.5,
        // The smallest are the farthest; the larger faint ones sit between
        // them and the bright, nearest stars.
        depth: u < 0.6 ? 0 : 1,
      };
    }
  );

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
