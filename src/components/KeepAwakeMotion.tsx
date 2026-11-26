import React, { useLayoutEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { LanternIcon, type PillProps, pillClassName } from "./KeepAwakeButton";

/*
  The keep-awake pill, animated. Loaded on its own, after the home screen has
  painted, so Motion never stands between the app and its first frame;
  KeepAwakeButton draws the same pill without animation until this arrives,
  and keeps all the state, so swapping one for the other changes nothing but
  the motion.

  The motion, settled in the "Lantern Pill" prototype: a spring with no
  bounce for the width, the words fading in just behind the opening edge and
  out ahead of the closing one, and the lit lantern swelling once as it
  lights. Module-level, so the once-a-second re-render hands Motion the same
  objects and nothing restarts (CLAUDE.md, "The once-a-second re-render").
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

/** An element's width, kept current as the system text size changes it. */
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
 * Only the pill's width moves. The lantern is pinned to its right edge and
 * the words are always laid out beside it, clipped by the pill, so the
 * opening edge reveals them and the closing edge covers them. Motion's
 * layout animation, which moves the children instead, let the words sit on
 * the lantern while the pill opened.
 */
const KeepAwakeMotion: React.FC<PillProps> = ({
  on,
  saying,
  lightings,
  words,
  onClick,
}) => {
  const reduceMotion = useReducedMotion();
  const wordsRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const wordsWidth = useWidth(wordsRef, [words]);
  const iconWidth = useWidth(iconRef, []);
  // The width animates only once it has been tapped here: arriving, being
  // first measured or a change of text size should just be the new size.
  const [tapped, setTapped] = useState(false);

  // The circle is the lantern plus 6px each side, as the padding draws it.
  const circle = iconWidth > 0 ? iconWidth + 12 : 36;
  const width = saying ? circle + wordsWidth : circle;

  return (
    <LazyMotion features={domAnimation} strict>
      <m.button
        type="button"
        className={pillClassName(on, saying)}
        aria-label="Keep screen on"
        aria-pressed={on}
        onClick={() => {
          setTapped(true);
          onClick();
        }}
        data-testid="keep-awake"
        data-animated="true"
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
          animate={{ opacity: saying ? 1 : 0 }}
          transition={reduceMotion ? INSTANT : saying ? WORDS_IN : WORDS_OUT}
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
    </LazyMotion>
  );
};

export default KeepAwakeMotion;
