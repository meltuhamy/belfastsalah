import React, { useEffect, useRef, useState } from "react";
import "./KeepAwakeButton.css";

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

/** What either drawing of the pill is given: the still one or the animated one. */
export type PillProps = {
  on: boolean;
  saying: boolean;
  // Counts the times it was lit, so each lighting plays the swell afresh.
  lightings: number;
  words: string;
  onClick: () => void;
};

export function pillClassName(on: boolean, saying: boolean): string {
  return [
    "KeepAwakeButton",
    on && "KeepAwakeButton--on",
    saying && "KeepAwakeButton--saying",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * The pill without animation: the same states, sized by CSS. It is what shows
 * until the animated one has loaded, or if it never does.
 */
const StillPill: React.FC<PillProps> = ({ on, saying, words, onClick }) => (
  <button
    type="button"
    className={pillClassName(on, saying) + " KeepAwakeButton--still"}
    aria-label="Keep screen on"
    aria-pressed={on}
    onClick={onClick}
    data-testid="keep-awake"
  >
    <span
      className="KeepAwakeButton__label"
      aria-hidden="true"
      data-testid="keep-awake-words"
    >
      {words}
    </span>
    <span className="KeepAwakeButton__icon">
      <span className="KeepAwakeButton__unlit">
        <LanternIcon lit={false} />
      </span>
      <span className="KeepAwakeButton__lit">
        <LanternIcon lit />
      </span>
    </span>
  </button>
);

/*
  Motion, and the animated pill with it, load on their own once the app is
  idle after its first paint, or at the first touch, whichever comes first.
  Shared across mounts, so the home screen coming back does not load it again.
*/
type AnimatedPill = React.ComponentType<PillProps>;
let animatedPill: AnimatedPill | null = null;
let loading: Promise<AnimatedPill | null> | null = null;

function loadAnimatedPill(): Promise<AnimatedPill | null> {
  loading ??= import("./KeepAwakeMotion")
    .then((module) => (animatedPill = module.default))
    .catch((error) => {
      // The still pill does everything but move, so this is only a warning,
      // and a later mount may try again.
      console.warn("Could not load the keep-awake animation", error);
      loading = null;
      return null;
    });
  return loading;
}

function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(callback, { timeout: 3000 });
    return () => window.cancelIdleCallback(handle);
  }
  // Safari before 18 has no requestIdleCallback.
  const handle = window.setTimeout(callback, 1500);
  return () => window.clearTimeout(handle);
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
 * The pill floats: its place in the toolbar is only ever the circle, so the
 * title never moves or wraps, and the open pill lies over the title when
 * there is not room beside it - at a large text size (MEL-105), say.
 *
 * A plain button, not an IonButton: ion-button copies aria-* into its
 * shadow button only on its first render, so aria-pressed went stale.
 */
const KeepAwakeButton: React.FC<{
  on: boolean;
  onToggle: () => void;
}> = ({ on, onToggle }) => {
  const [saying, setSaying] = useState(false);
  const [lightings, setLightings] = useState(0);
  const [Animated, setAnimated] = useState<AnimatedPill | null>(
    () => animatedPill
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Animated != null) {
      return;
    }
    let live = true;
    let touched = false;
    // Never swapped in while a finger or button is down. A tap that began on
    // the still pill and ended on the animated one had its button taken away
    // from under it, so the browser sent the click to the slot instead and
    // the tap did nothing. After the press, the swap waits long enough for
    // the click to have arrived.
    let pressing = false;
    let ready: AnimatedPill | null = null;
    let settle: ReturnType<typeof setTimeout> | null = null;
    const swap = () => {
      if (live && ready != null && !pressing && settle == null) {
        setAnimated(() => ready);
      }
    };
    const load = () => {
      void loadAnimatedPill().then((pill) => {
        ready = pill;
        swap();
      });
    };
    const cancel = whenIdle(load);
    const onDown = () => {
      pressing = true;
      if (settle != null) clearTimeout(settle);
      settle = null;
      // A touch anywhere means a tap may be coming: start now, or try again
      // if loading once the app was idle failed. Only the first touch.
      if (!touched) {
        touched = true;
        load();
      }
    };
    const onUp = () => {
      pressing = false;
      if (settle != null) clearTimeout(settle);
      settle = setTimeout(() => {
        settle = null;
        swap();
      }, 250);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      live = false;
      cancel();
      if (settle != null) clearTimeout(settle);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, [Animated]);

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    []
  );

  const onClick = () => {
    if (!on) setLightings((n) => n + 1);
    onToggle();
    setSaying(true);
    if (timer.current != null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaying(false), SAY_MILLIS);
  };

  const props: PillProps = {
    on,
    saying,
    lightings,
    words: on ? COPY_ON : COPY_OFF,
    onClick,
  };
  return (
    <span className="KeepAwakeButton__slot">
      {Animated != null ? <Animated {...props} /> : <StillPill {...props} />}
    </span>
  );
};

export default KeepAwakeButton;
