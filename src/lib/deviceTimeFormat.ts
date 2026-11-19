/**
 * The device's own 12/24-hour switch, kept current.
 *
 * On a phone this is a native read, not a guess from the locale: the web layer
 * sees language and region, and neither is the switch. The native plugins
 * (DeviceClockPlugin.kt and DeviceClockPlugin.swift) report the value and send
 * an event when it changes; the shells register them by hand, as they do the
 * widget and reminder plugins.
 *
 * On the web there is no such switch, so the best available answer is the
 * browser's own hour cycle - which is what the old 24-hour-only app ignored.
 */

import {
  Capacitor,
  PluginListenerHandle,
  registerPlugin,
} from "@capacitor/core";

type DeviceClockPlugin = {
  getFormat(): Promise<{ uses24Hour: boolean }>;
  addListener(
    eventName: "timeFormatChanged",
    listener: (event: { uses24Hour: boolean }) => void
  ): Promise<PluginListenerHandle>;
};

const DeviceClock = registerPlugin<DeviceClockPlugin>("DeviceClock");

/**
 * The browser's hour cycle, used before the native answer arrives and on the
 * web. Requesting an hour is what makes Intl report a cycle at all.
 */
export function guessDeviceUses24Hour(): boolean {
  try {
    const { hourCycle, hour12 } = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
    }).resolvedOptions();
    if (hourCycle) {
      return hourCycle === "h23" || hourCycle === "h24";
    }
    if (typeof hour12 === "boolean") {
      return !hour12;
    }
  } catch {
    // An engine without Intl: the timetable's own clock is the safe default.
  }
  return true;
}

let current = guessDeviceUses24Hour();
const listeners = new Set<(uses24Hour: boolean) => void>();

export function getDeviceUses24Hour(): boolean {
  return current;
}

/**
 * Calls `listener` whenever the phone's switch changes, and returns an
 * unsubscribe function. Re-reads nothing: the hook does that on subscribe.
 */
export function subscribeDeviceUses24Hour(
  listener: (uses24Hour: boolean) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setDeviceUses24Hour(uses24Hour: boolean) {
  if (uses24Hour === current) {
    return;
  }
  current = uses24Hour;
  listeners.forEach((listener) => listener(uses24Hour));
}

let started = false;

/**
 * Asks the native side once, then listens for changes. A failed call leaves
 * the flag down so a later mount can try again; the cached guess remains.
 */
export async function startDeviceTimeFormatWatch(): Promise<void> {
  if (started || !Capacitor.isNativePlatform()) {
    return;
  }
  started = true;
  try {
    const { uses24Hour } = await DeviceClock.getFormat();
    setDeviceUses24Hour(uses24Hour);
    await DeviceClock.addListener(
      "timeFormatChanged",
      ({ uses24Hour: next }) => setDeviceUses24Hour(next)
    );
  } catch (error) {
    console.warn("Could not read the device's time format", error);
    started = false;
  }
}
