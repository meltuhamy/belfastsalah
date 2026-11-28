import { useEffect, useSyncExternalStore } from "react";
import { Prayer, PrayerDayTimes } from "./PrayerTimes";
import { Theme } from "./theme";

/**
 * What the day card preview (DayCardPreviewPage) wants painted: a theme,
 * a day and a moment that are not the app's own. useTheme, in App, stays the
 * only thing that touches the palette and the sky's properties; while a
 * preview is open it paints these instead, and the app's own again once the
 * preview has gone.
 */
export type ThemePreview = {
  theme: Theme;
  nextPrayer: Prayer | null;
  today: PrayerDayTimes | null;
  timeZone: string;
  now: Date;
};

let current: ThemePreview | null = null;
const listeners = new Set<() => void>();

function publish(value: ThemePreview | null) {
  current = value;
  listeners.forEach((listener) => listener());
}

/** The preview to paint, or null for the app's own. */
export function useThemePreview(): ThemePreview | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null
  );
}

/** Puts this preview on screen while the calling component is mounted. */
export function usePublishThemePreview(preview: ThemePreview): void {
  const { theme, nextPrayer, today, timeZone, now } = preview;
  // Republished when the minute does - the sky moves no faster - or when
  // anything else changes.
  const minute = Math.floor(now.getTime() / 60_000);
  useEffect(() => {
    publish({ theme, nextPrayer, today, timeZone, now: new Date(minute * 60_000) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, nextPrayer, today, timeZone, minute]);
  useEffect(() => () => publish(null), []);
}
