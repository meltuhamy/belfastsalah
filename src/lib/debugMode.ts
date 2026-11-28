import { useSyncExternalStore } from "react";
import { Preferences } from "@capacitor/preferences";

/**
 * Debug mode: extra rows in settings for looking at the app as a developer
 * would - the day card at any moment, anywhere. Turned on by the Version
 * row's gesture (debugUnlock.ts), off from its own row.
 *
 * Kept apart from AppSettings on purpose: it is not a setting anyone should
 * meet, migrate or sync, and turning it off leaves nothing behind.
 */

const KEY = "debugMode";

let on = false;
const listeners = new Set<() => void>();

function set(value: boolean) {
  if (value === on) return;
  on = value;
  listeners.forEach((listener) => listener());
}

// Read once at start-up; until it arrives, debug mode is off.
void Preferences.get({ key: KEY })
  .then(({ value }) => set(value === "on"))
  .catch(() => {});

export async function setDebugMode(value: boolean): Promise<void> {
  set(value);
  if (value) await Preferences.set({ key: KEY, value: "on" });
  else await Preferences.remove({ key: KEY });
}

export function useDebugMode(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => on,
    () => false
  );
}
