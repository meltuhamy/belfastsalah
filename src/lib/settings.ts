import { Preferences } from "@capacitor/preferences";
import { AsrMethod, PrayerLocation } from "./PrayerTimes";
import { Theme } from "./theme";
import { TimeFormat } from "./timeFormat";
import { migrateReminders, PrayerReminders, defaultReminders } from "./prayerReminders";

import debounce from "./debounce";

const STORAGE_KEY = "settings";

const saveCallbacks: Array<() => void> = [];

export type AppSettings = {
  // Prayer Notifications: the switch for all reminders.
  notify: boolean;
  // Each prayer's reminder: on or off, minutes before or after, and sound.
  // Settings saved before this existed had one lead time (notifyMinutes) for
  // every prayer, which migrateSettings carries over.
  reminders: PrayerReminders;
  asrMethod: AsrMethod;
  // Light, dark, follow the device, or dark between Maghrib and sunrise.
  theme: Theme;
  // System follows the phone's own 12/24-hour switch; the other two override
  // it. Missing in settings saved by older versions, which reads as System.
  timeFormat: TimeFormat;
  location: PrayerLocation | null;
  // False shows the timetable's own clock, which is what the mosque prints.
  showTimesInDeviceZone: boolean;
  // Whether the one-off "your device isn't on London time" prompt has been
  // answered. Missing in settings saved by older versions, which reads as
  // false, so the prompt appears once for anyone it applies to.
  timeZoneNoticeSeen: boolean;
  // Keeps the screen on while the app is in front: the cup beside the
  // settings cog on the home screen. Missing in older settings, which reads
  // as off, the phone's own behaviour.
  keepAwake: boolean;
};

export function getDefaultSettings(): AppSettings {
  return {
    notify: false,
    // Five minutes before every prayer with the phone's own sound, as
    // reminders always were. An adhan is opt-in.
    reminders: defaultReminders(),
    asrMethod: AsrMethod.Shafi,
    // Sky is the default for a new install: the app's own look, and dark
    // or light by the day's prayer times rather than the device. Settings
    // saved before it keep whatever theme they had.
    theme: "sky",
    timeFormat: "system",
    location: null,
    showTimesInDeviceZone: false,
    timeZoneNoticeSeen: false,
    keepAwake: false,
  };
}

// What settings looked like before the theme rewrite: a pair of booleans, the
// second only meaningful when the first was on. And before per-prayer
// reminders: one lead time, and briefly one sound plus Fajr's own.
type LegacySettings = {
  nightMode?: boolean;
  nightModeMaghrib?: boolean;
  notifyMinutes?: unknown;
  notifySound?: unknown;
  fajrSound?: unknown;
};

function themeFromLegacy(legacy: LegacySettings): Theme | null {
  if (legacy.nightMode == null) {
    return null;
  }
  if (!legacy.nightMode) {
    return "light";
  }
  // "Dark after Maghrib" became its own theme, which Sky has since replaced.
  return legacy.nightModeMaghrib ? "sky" : "dark";
}

/**
 * Brings a stored blob up to the current shape.
 *
 * Fields added since it was written fall back to their defaults, and the old
 * dark-mode booleans map onto the theme they were producing - so an upgrade
 * looks like nothing happened rather than silently resetting someone's
 * appearance. Deliberately does not map an old "off" to "system": it was an
 * explicit setting, even if its initial value came from the device.
 */
export function migrateSettings(stored: unknown): AppSettings {
  const {
    nightMode,
    nightModeMaghrib,
    notifyMinutes,
    notifySound,
    fajrSound,
    reminders,
    ...rest
  } = (stored ?? {}) as LegacySettings & Partial<AppSettings>;
  const legacyTheme = themeFromLegacy({ nightMode, nightModeMaghrib });
  const defaults = {
    ...getDefaultSettings(),
    // Settings saved without a theme were following the device, which was
    // the default then. Sky is the default for new installs only, so an
    // upgrade does not change how the app looks.
    theme: "system" as Theme,
  };
  // "Dark after Maghrib" is gone; Sky goes dark at Maghrib too, and has the
  // day's colours besides.
  const storedTheme = (rest as { theme?: string }).theme;
  const theme: Theme | null =
    legacyTheme ?? (storedTheme === "maghrib" ? "sky" : null);
  return {
    ...defaults,
    ...rest,
    ...(theme === null ? {} : { theme }),
    reminders: migrateReminders(reminders, { notifyMinutes, notifySound, fajrSound }),
  };
}

async function getSettingsFromStorage(): Promise<AppSettings | null> {
  const appSettings = await Preferences.get({ key: STORAGE_KEY });
  if (!appSettings.value) {
    return null;
  }

  return migrateSettings(JSON.parse(appSettings.value));
}

let settingsCache: AppSettings | null | undefined = undefined;
export async function getSettings(): Promise<AppSettings | null> {
  if (settingsCache === undefined) {
    settingsCache = await getSettingsFromStorage();
  }
  return settingsCache;
}

export type SaveOptions = {
  // A change that announces itself, like the keep-awake toggle, skips the
  // "Your settings have been saved" toast so two toasts do not stack.
  quiet?: boolean;
};

async function saveSettingsToStorage(
  appSettings: AppSettings,
  options: SaveOptions = {}
) {
  await Preferences.set({
    key: STORAGE_KEY,
    value: JSON.stringify(appSettings),
  });
  if (!options.quiet) {
    saveCallbacks.forEach((cb) => cb());
  }
}

const saveSettingsToStorageDebounced = debounce(saveSettingsToStorage, 500);

export async function saveSettings(
  appSettings: AppSettings,
  options: SaveOptions = {}
) {
  settingsCache = appSettings;
  return saveSettingsToStorageDebounced(appSettings, options);
}

export function addSaveListener(callback: () => void) {
  saveCallbacks.push(callback);
}

export function removeSaveListener(callback: () => void) {
  // Guarded: indexOf returns -1 for a callback that was never added, and
  // splice(-1, 1) would drop somebody else's listener instead of nothing.
  const index = saveCallbacks.indexOf(callback);
  if (index !== -1) {
    saveCallbacks.splice(index, 1);
  }
}
