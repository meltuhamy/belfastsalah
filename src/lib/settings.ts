import { Storage } from "@capacitor/storage";
import { AsrMethod, PrayerLocation } from "./PrayerTimes";

import debounce from "./debounce";

const STORAGE_KEY = "settings";
const isSystemDarkMode =
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const saveCallbacks: Array<() => void> = [];

export type AppSettings = {
  notify: boolean;
  notifyMinutes: number;
  asrMethod: AsrMethod;
  nightMode: boolean;
  nightModeMaghrib: boolean;
  location: PrayerLocation | null;
};

export function getDefaultSettings(): AppSettings {
  return {
    notify: false,
    notifyMinutes: 5,
    asrMethod: AsrMethod.Shafi,
    nightMode: isSystemDarkMode,
    nightModeMaghrib: false,
    location: null,
  };
}

async function getSettingsFromStorage(): Promise<AppSettings | null> {
  const appSettings = await Storage.get({ key: STORAGE_KEY });
  if (!appSettings.value) {
    return null;
  }

  return JSON.parse(appSettings.value);
}

let settingsCache: AppSettings | null | undefined = undefined;
export async function getSettings(): Promise<AppSettings | null> {
  if (settingsCache === undefined) {
    settingsCache = await getSettingsFromStorage();
  }
  return settingsCache;
}

async function saveSettingsToStorage(appSettings: AppSettings) {
  await Storage.set({
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
  saveCallbacks.splice(saveCallbacks.indexOf(callback), 1);
}
