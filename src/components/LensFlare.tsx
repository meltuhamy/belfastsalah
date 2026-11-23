import React, { useRef } from "react";
import { useTilt } from "../lib/useTilt";
import "./LensFlare.css";

/**
 * How far, in px, the phone's tilt moves the lens's centre. The ghosts sit
 * on the line from the sun through that centre, so the farthest swing about
 * twice this.
 */
const LENS_SHIFT = 22;

type Ghost = {
  /** Where on the line from the sun through the lens centre: 0 the sun, 1 the centre. */
  at: number;
  /** Diameter in px. */
  size: number;
  /** Strength at the middle, 0 to 1. */
  strength: number;
  /** Its tint, as "r, g, b": real ghosts pick up a colour from the lens coatings. */
  tint: string;
  /** Hexagonal, like the iris of a camera, rather than round. */
  iris?: boolean;
};

/**
 * Few and faint: a hint of bright light rather than a camera effect. The
 * farther from the sun, the larger and fainter, as a lens's reflections are.
 */
const GHOSTS: ReadonlyArray<Ghost> = [
  { at: 0.42, size: 9, strength: 0.2, tint: "255, 236, 196" },
  { at: 0.78, size: 18, strength: 0.09, tint: "196, 255, 222", iris: true },
  { at: 1.22, size: 36, strength: 0.07, tint: "176, 214, 255" },
  { at: 1.58, size: 15, strength: 0.13, tint: "255, 208, 168" },
  { at: 1.96, size: 26, strength: 0.06, tint: "214, 192, 255", iris: true },
];

/**
 * The Sky theme's daytime lens flare: soft reflections strung along the line
 * from the sun through the middle of the card, as a camera pointed near the
 * sun would show. Tipping the phone moves the lens's centre, so the line
 * swings about the sun, the farthest ghosts most - which is what makes it read
 * as light catching the glass rather than a picture on it. Fades with the sun
 * (`--sky-sun-on`); drawn in a layer of the card's own clipped sky.
 */
const LensFlare: React.FC = () => {
  const lens = useRef<HTMLSpanElement>(null);

  useTilt(({ x, y }) => {
    lens.current?.style.setProperty(
      "--lens-x",
      `${(x * LENS_SHIFT).toFixed(2)}px`
    );
    lens.current?.style.setProperty(
      "--lens-y",
      `${(y * LENS_SHIFT).toFixed(2)}px`
    );
  });

  return (
    <span
      ref={lens}
      className="LensFlare"
      aria-hidden="true"
      data-testid="lens-flare"
    >
      <span className="LensFlare__veil" />
      {GHOSTS.map((ghost, i) => (
        <span
          key={i}
          className={`LensFlare__ghost${
            ghost.iris ? " LensFlare__ghost--iris" : ""
          }`}
          style={
            {
              "--at": ghost.at,
              "--tint": ghost.tint,
              "--strength": ghost.strength,
              width: ghost.size,
              height: ghost.size,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
};

export default LensFlare;
