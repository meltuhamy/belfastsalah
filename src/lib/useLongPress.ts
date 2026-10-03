import { useEffect, useRef } from "react";

const DEFAULT_DELAY_MS = 600;

/**
 * Fires once the pointer has been held down for `delay` without moving away.
 *
 * The callback is kept in a ref because the screens using this re-render every
 * second off the app ticker, so a handler captured at bind time would go stale.
 */
export function useLongPress(
  onLongPress: () => void,
  delay = DEFAULT_DELAY_MS
) {
  const savedCallback = useRef(onLongPress);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    savedCallback.current = onLongPress;
  }, [onLongPress]);

  function cancel() {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  }

  useEffect(() => cancel, []);

  return {
    onPointerDown: () => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = undefined;
        savedCallback.current();
      }, delay);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    // A long press on touch otherwise pops the text selection / context menu.
    onContextMenu: (event: { preventDefault: () => void }) =>
      event.preventDefault(),
  };
}
