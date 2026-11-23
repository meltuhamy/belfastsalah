import { useEffect, useRef } from "react";
import { createTiltFollower, Tilt } from "./tilt";

/**
 * Calls `onTilt` with the phone's tilt, as an offset from -1 to 1 on each axis
 * measured from a resting angle that soon catches up (tilt.ts), at most once a
 * frame. For the Sky theme's decorations - the stars and the lens flare - which
 * write it straight onto their elements rather than through state, since the
 * app re-renders every second.
 *
 * Nothing for anyone who asks for reduced motion. iOS sends no readings until
 * the page asks, and only lets it ask after a tap; Capacitor's web view grants
 * the request itself, so nobody is shown a prompt: it asks on mount, and if
 * that is refused for want of a tap, again on the first one.
 */
export function useTilt(onTilt: (tilt: Tilt) => void): void {
  const latest = useRef(onTilt);
  latest.current = onTilt;

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const follow = createTiltFollower(1);
    let frame = 0;
    const onOrientation = (event: DeviceOrientationEvent) => {
      const tilt = follow(event.beta, event.gamma, event.timeStamp);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => latest.current(tilt));
    };
    window.addEventListener("deviceorientation", onOrientation);

    const ask =
      typeof DeviceOrientationEvent === "undefined"
        ? undefined
        : (
            DeviceOrientationEvent as unknown as {
              requestPermission?: () => Promise<string>;
            }
          ).requestPermission?.bind(DeviceOrientationEvent);
    const askOnTap = () => {
      ask?.().catch(() => undefined);
    };
    if (ask != null) {
      ask().catch(() =>
        window.addEventListener("pointerup", askOnTap, { once: true })
      );
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("pointerup", askOnTap);
    };
  }, []);
}
