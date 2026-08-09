import { Preferences } from "@capacitor/preferences";
import { AsrMethod, PrayerLocation } from "./PrayerTimes";
import { Theme } from "./theme";

import debounce from "./debounce";

const STORAGE_KEY = "settings";

const saveCallbacks: Array<() => void> = [];

export type AppSettings = {
  notify: boolean;
  notifyMinutes: number;
  asrMethod: AsrMethod;
  // Light, dark, follow the device, or dark between Maghrib and sunrise.
  theme: Theme;
  location: PrayerLocation | null;
  // False shows the timetable's own clock, which is what the mosque prints.
  showTimesInDeviceZone: boolean;
  // Whether the one-off "your device isn't on London time" prompt has been
  // answered. Missing in settings saved by older versions, which reads as
  // false, so the prompt appears once for anyone it applies to.
  timeZoneNoticeSeen: boolean;
};

export function getDefaultSettings(): AppSettings {
  return {
    notify: false,
    notifyMinutes: 5,
    asrMethod: AsrMethod.Shafi,
    // Following the device is the default. It used to be a boolean seeded
    // from the device once at first launch and then never updated again.
    theme: "system",
    location: null,
    showTimesInDeviceZone: false,
    timeZoneNoticeSeen: false,
  };
}

// What settings looked like before the theme rewrite: a pair of booleans, the
// second only meaningful when the first was on.
type LegacySettings = {
  nightMode?: boolean;
  nightModeMaghrib?: boolean;
};

function themeFromLegacy(legacy: LegacySettings): Theme | null {
  if (legacy.nightMode == null) {
    return null;
  }
  if (!legacy.nightMode) {
    return "light";
  }
  return legacy.nightModeMaghrib ? "maghrib" : "dark";
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
  const { nightMode, nightModeMaghrib, ...rest } = (stored ?? {}) as
    LegacySettings & Partial<AppSettings>;
  const legacyTheme = themeFromLegacy({ nightMode, nightModeMaghrib });
  return {
    ...getDefaultSettings(),
    ...rest,
    ...(legacyTheme === null ? {} : { theme: legacyTheme }),
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

async function saveSettingsToStorage(appSettings: AppSettings) {
  await Preferences.set({
    key: STORAGE_KEY,
    value: JSON.stringify(appSettings),
  });
  saveCallbacks.forEach((cb) => cb());
}

const saveSettingsToStorageDebounced = debounce(saveSettingsToStorage, 500);

export async function saveSettings(appSettings: AppSettings) {
  settingsCache = appSettings;
  return saveSettingsToStorageDebounced(appSettings);
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
