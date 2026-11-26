import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
  type Transition,
} from "motion/react";
import "./KeepAwakeButton.css";
import { useLargeText } from "../lib/textScale";

/**
 * The fanous: a lantern under a crescent, drawn like AdhanIcon - filled
 * shapes on a 24-unit grid, in currentColor - and with the same crescent,
 * a third bigger. Unlit, the glass is an outline; lit, it is tinted and a
 * slim flame stands inside it.
 */
export const LanternIcon: React.FC<{ lit: boolean; className?: string }> = ({
  lit,
  className,
}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path
      transform="translate(12 3.2) scale(1.3) translate(-9 -5.95)"
      d="M9.579 3.879A2.15 2.15 0 1 0 10.774 7.165A1.75 1.75 0 0 1 9.579 3.879Z"
    />
    <rect x="11.8" y="5.7" width="0.4" height="1" />
    <path d="M12 6.5c.7 1 3.5 1.9 3.5 3.5h-7c0-1.6 2.8-2.5 3.5-3.5z" />
    <rect x="8.1" y="10" width="7.8" height="1.1" rx="0.55" />
    <path
      d="M8.7 11.7h6.6l-.95 7.2h-4.7z"
      fill={lit ? "currentColor" : "none"}
      fillOpacity={lit ? 0.28 : undefined}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {lit ? (
      <path d="M12 12.9c-.95 1.35-1.5 2.3-1.5 3.25a1.5 1.5 0 0 0 3 0c0-.95-.55-1.9-1.5-3.25z" />
    ) : (
      <path d="M12 11.7v7.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
    )}
    <rect x="9.2" y="19.5" width="5.6" height="1.2" rx="0.6" />
    <path d="M10.2 20.9h3.6l.4 1.6h-4.4z" />
  </svg>
);

export const COPY_ON = "Screen always on";
export const COPY_OFF = "Screen normal";

/** How long the words stay after a tap before the pill folds them away. */
export const SAY_MILLIS = 5000;

/*
  The motion, settled in the "Lantern Pill" prototype: a spring with no
  bounce for the width, the words fading in just behind the opening edge and
  out ahead of the closing one, and the lit lantern swelling once as it
  lights. Module-level, so the once-a-second re-render hands Motion the same
  objects and nothing restarts (see CLAUDE.md, "The once-a-second re-render").
*/
const WIDTH: Transition = { type: "spring", bounce: 0, duration: 0.45 };
const WORDS_IN: Transition = { duration: 0.22, delay: 0.06 };
const WORDS_OUT: Transition = { duration: 0.16 };
const FADE: Transition = { duration: 0.2 };
const INSTANT: Transition = { duration: 0 };
const LIGHT_UP = { opacity: 1, scale: [0.82, 1.14, 1] };
const LIGHT_UP_TRANSITION: Transition = {
  opacity: FADE,
  scale: {
    duration: 0.55,
    times: [0, 0.45, 1],
    ease: [
      [0.05, 0.7, 0.1, 1],
      [0.3, 0, 0.2, 1],
    ],
  },
};

/** Watches an element's width, which follows the system text size. */
function useWidth(ref: React.RefObject<HTMLElement | null>, deps: unknown[]) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el == null) {
      return;
    }
    const measure = () => setWidth(el.offsetWidth);
    measure();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    // The words are measured in the app's font, which may still be loading.
    void document.fonts?.ready.then(measure);
    return () => observer?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return width;
}

/**
 * The keep-awake toggle beside the settings cog (MEL-356).
 *
 * Off, it is the unlit lantern, an icon like the cog. A tap opens it into a
 * pill that says what happened - "Screen always on", or "Screen normal" -
 * and after five seconds the pill folds the words away again: to the lit
 * lantern on its tinted circle while it is on, to the plain icon once off.
 * Tapping while the words show flips it again and starts the five seconds
 * over.
 *
 * The lantern is pinned to the pill's right edge, beside the cog, and never
 * moves. The words are always laid out just left of it and the pill clips
 * them; Motion animates only the pill's width, between the circle and the
 * circle plus the words' measured width, so its left edge sweeps over the
 * words to reveal or cover them. Moving the words themselves (Motion's
 * layout animation, tried first) let them sit on the lantern while the pill
 * opened, and nudged the lantern as they left.
 *
 * At a large system text size (MEL-105) the words would squeeze the title
 * until it broke mid-word, so there it never says anything: the lantern
 * lights on its circle, or goes out.
 *
 * A plain button, not an IonButton: ion-button copies aria-* into its
 * shadow button only on its first render, so aria-pressed went stale.
 */
const KeepAwakeButton: React.FC<{
  on: boolean;
  onToggle: () => void;
}> = ({ on, onToggle }) => {
  const largeText = useLargeText();
  const reduceMotion = useReducedMotion();
  const [saying, setSaying] = useState(false);
  // Counts the times it was lit, so each lighting plays the swell afresh.
  const [lightings, setLightings] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordsRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  const words = on ? COPY_ON : COPY_OFF;
  const wordsWidth = useWidth(wordsRef, [words]);
  const iconWidth = useWidth(iconRef, []);

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    []
  );

  // Only a tap animates the width. Anything else that resizes the pill - the
  // first measurement, a change of text size - should just be the new size.
  const [tapped, setTapped] = useState(false);

  const toggle = () => {
    setTapped(true);
    if (!on) setLightings((n) => n + 1);
    onToggle();
    if (timer.current != null) clearTimeout(timer.current);
    if (largeText) {
      setSaying(false);
      return;
    }
    setSaying(true);
    timer.current = setTimeout(() => setSaying(false), SAY_MILLIS);
  };

  const showWords = saying && !largeText;
  // The circle: the lantern plus 6px each side, as the padding draws it. 36px
  // until the lantern has been measured, which is its size at the default
  // text size.
  const circle = iconWidth > 0 ? iconWidth + 12 : 36;
  const width = showWords ? circle + wordsWidth : circle;

  const className = [
    "KeepAwakeButton",
    on && "KeepAwakeButton--on",
    showWords && "KeepAwakeButton--saying",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <LazyMotion features={domAnimation} strict>
      <span className="KeepAwakeButton__target">
        <m.button
          type="button"
          className={className}
          aria-label="Keep screen on"
          aria-pressed={on}
          onClick={toggle}
          data-testid="keep-awake"
          initial={false}
          animate={{ width }}
          transition={reduceMotion || !tapped ? INSTANT : WIDTH}
        >
          <m.span
            ref={wordsRef}
            className="KeepAwakeButton__label"
            aria-hidden="true"
            data-testid="keep-awake-words"
            initial={false}
            animate={{ opacity: showWords ? 1 : 0 }}
            transition={reduceMotion ? INSTANT : showWords ? WORDS_IN : WORDS_OUT}
          >
            {words}
          </m.span>
          <span className="KeepAwakeButton__icon" ref={iconRef}>
            <m.span
              className="KeepAwakeButton__unlit"
              initial={false}
              animate={{ opacity: on ? 0 : 1 }}
              transition={reduceMotion ? INSTANT : FADE}
            >
              <LanternIcon lit={false} />
            </m.span>
            <AnimatePresence initial={false}>
              {on && (
                <m.span
                  key={lightings}
                  className="KeepAwakeButton__lit"
                  initial={{ opacity: 0, scale: 0.82 }}
                  animate={reduceMotion ? { opacity: 1, scale: 1 } : LIGHT_UP}
                  exit={{ opacity: 0 }}
                  transition={reduceMotion ? INSTANT : LIGHT_UP_TRANSITION}
                >
                  <LanternIcon lit />
                </m.span>
              )}
            </AnimatePresence>
          </span>
        </m.button>
      </span>
    </LazyMotion>
  );
};

export default KeepAwakeButton;
