/**
 * What the app looks like, and what decides it.
 *
 * One setting with four values rather than the pair of coupled booleans this
 * replaces. "System" is the default and the reason for the rewrite: it used to
 * be sampled once, at first launch, and frozen into a stored boolean, so the
 * app never followed the device again - not on the device's own light/dark
 * schedule, and not when the user changed it by hand.
 */

import { Prayer } from "./PrayerTimes";

export type Theme = "system" | "light" | "dark" | "maghrib";

// Also the order they appear in the picker: the standard three first, then
// the one specific to this app.
export const THEMES: ReadonlyArray<Theme> = ["system", "light", "dark", "maghrib"];

export const themeLabels: Record<Theme, string> = {
  system: "Match device",
  light: "Light",
  dark: "Dark",
  maghrib: "Dark after Maghrib",
};

/** Ionic 8 ships this palette; adding the class to <html> switches to it. */
export const DARK_PALETTE_CLASS = "ion-palette-dark";

/** What the device's own light/dark setting currently says. */
export function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

// Night runs from Maghrib to sunrise, which is exactly the stretch where the
// prayer still ahead of you is Isha, Fajr or Shuruq.
const NIGHT_PRAYERS: ReadonlySet<Prayer> = new Set([
  Prayer.Isha,
  Prayer.Fajr,
  Prayer.Shuruq,
]);

type Conditions = {
  prefersDark: boolean;
  /** The prayer still to come, or null before the timetable has loaded. */
  nextPrayer: Prayer | null;
};

/** Whether the dark palette applies right now. */
export function isDark(theme: Theme, conditions: Conditions): boolean {
  switch (theme) {
    case "light":
      return false;
    case "dark":
      return true;
    case "maghrib":
      // Falling back to the device's setting rather than to light: it is the
      // better guess for the moment before the timetable arrives, and someone
      // who picked this mode wants dark at night, which is when a device is
      // most likely to be dark too.
      return conditions.nextPrayer === null
        ? conditions.prefersDark
        : NIGHT_PRAYERS.has(conditions.nextPrayer);
    case "system":
      return conditions.prefersDark;
  }
}
