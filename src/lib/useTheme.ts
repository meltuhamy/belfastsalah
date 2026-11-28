import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AsrMethod,
  Prayer,
  PrayerDayTimes,
  PrayerLocation,
  createPrayerTimes,
} from "./PrayerTimes";
import { skyProperties } from "./sky";
import { applyStatusBarStyle } from "./statusBar";
import {
  DARK_PALETTE_CLASS,
  SKY_THEME_CLASS,
  Theme,
  isDark,
  isSkyTheme,
  systemPrefersDark,
} from "./theme";
import { UK_TIME_ZONE, getZonedDateParts } from "./timeZone";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The device's light/dark setting, kept current rather than read once. */
function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia?.(DARK_QUERY);
    if (query == null) {
      return;
    }
    // Re-read on subscribe: the setting can change between first render and
    // this effect, and that change would otherwise never arrive.
    setPrefersDark(query.matches);

    const handleChange = (event: MediaQueryListEvent) =>
      setPrefersDark(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return prefersDark;
}

/**
 * The day the sky is drawn from: today's times once the app has them.
 *
 * Setup has no stored location yet, and so no times, but someone choosing a
 * theme there has to be able to see it. London's day stands in until then -
 * it is setup's own starting location, and the two timetables' skies are
 * minutes apart.
 */
function useSkyDay(
  active: boolean,
  today: PrayerDayTimes | null,
  now: Date
): PrayerDayTimes | null {
  const [standIn, setStandIn] = useState<PrayerDayTimes | null>(null);
  const needsStandIn = active && today === null;
  const ukDay = getZonedDateParts(now, UK_TIME_ZONE).day;

  useEffect(() => {
    if (!needsStandIn) {
      return;
    }
    let cancelled = false;
    createPrayerTimes(PrayerLocation.London, AsrMethod.Shafi)
      .getDay(new Date())
      .then((day) => {
        if (!cancelled) setStandIn(day);
      });
    return () => {
      cancelled = true;
    };
  }, [needsStandIn, ukDay]);

  return today ?? (active ? standIn : null);
}

/** The prayer still to come on a day, or tomorrow's Fajr after Isha. */
function nextOn(day: PrayerDayTimes, now: Date): Prayer {
  return day.find((p) => p.time > now)?.prayer ?? Prayer.Fajr;
}

/**
 * Applies the chosen theme to the document. Sole owner of the palette class,
 * and of the Sky theme's class and custom properties - nothing else should
 * add or remove them.
 *
 * Called on every render, which is once a second off the app's ticker. The
 * sky is only worked out again when the minute changes: it moves far too
 * slowly to need more, and setting a style on <html> restyles everything.
 */
export function useTheme(
  theme: Theme,
  nextPrayer: Prayer | null,
  today: PrayerDayTimes | null,
  /** The timetable's zone, which decides where its day starts and ends. */
  timeZone: string
): void {
  const prefersDark = useSystemPrefersDark();
  const now = new Date();
  const sky = isSkyTheme(theme);
  const skyDay = useSkyDay(sky, today, now);
  // London's zone goes with London's stand-in day.
  const skyZone = today === null ? UK_TIME_ZONE : timeZone;
  const dark = isDark(theme, {
    prefersDark,
    nextPrayer:
      nextPrayer ?? (sky && skyDay !== null ? nextOn(skyDay, now) : null),
  });
  const minute = Math.floor(now.getTime() / 60_000);

  // Layout effect so the palette is in place before the browser paints,
  // rather than flashing the wrong one for a frame.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle(DARK_PALETTE_CLASS, dark);
  }, [dark]);

  // The bars are drawn over the app, so their icons follow its palette rather
  // than the device's - including when the two disagree, and when Sky flips.
  useLayoutEffect(() => {
    void applyStatusBarStyle(dark);
  }, [dark]);

  const applied = useRef<Array<string>>([]);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const properties =
      sky && skyDay !== null
        ? skyProperties(new Date(minute * 60_000), skyDay, skyZone, dark)
        : {};
    for (const name of applied.current) {
      if (!(name in properties)) root.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(properties)) {
      root.style.setProperty(name, value);
    }
    applied.current = Object.keys(properties);
    root.classList.toggle(SKY_THEME_CLASS, applied.current.length > 0);
  }, [sky, skyDay, skyZone, dark, minute]);
}
