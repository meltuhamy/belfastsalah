import { Capacitor, registerPlugin } from "@capacitor/core";
import { AppSettings, getDefaultSettings } from "./settings";
import { buildReminderPayload } from "./reminderPayload";
import {
  announceReminderChange,
  ensureNotificationPermission,
} from "./notifications";

type PrayerRemindersPlugin = {
  /** Replaces the stored list. An empty payload clears it and the alarms. */
  sync(options: { payload: string }): Promise<void>;
};

const PrayerReminders = registerPlugin<PrayerRemindersPlugin>("PrayerReminders");

type ReminderSettings = Pick<
  AppSettings,
  | "notify"
  | "notifyMinutes"
  | "location"
  | "asrMethod"
  | "showTimesInDeviceZone"
>;

// What was last written successfully this session, and what it was made from.
// A foreground refresh usually rebuilds the same list; its `generatedAt` is
// the only thing that differs, so that is left out of the key. Handing 11,000
// entries to the bridge to store an identical list is work with no result.
let lastWrittenKey: string | null = null;

/**
 * Writes Android's reminder list and lets the native side arm the next two
 * days. iOS and the web keep the plugin's own schedule; this returns without
 * touching it.
 *
 * A failed write leaves the previous list in place, and leaves it worth
 * writing again. The caller logs it.
 */
export async function syncAndroidReminders(
  settings: ReminderSettings,
  now: Date,
  silent: boolean
): Promise<void> {
  if (Capacitor.getPlatform() !== "android") {
    return;
  }

  const write = async (payload: string, key: string, updated: boolean) => {
    if (key === lastWrittenKey) {
      return;
    }
    await PrayerReminders.sync({ payload });
    lastWrittenKey = key;
    announceReminderChange(updated, silent);
  };

  if (!settings.notify || settings.location === null) {
    await write("", "", false);
    return;
  }

  if (!(await ensureNotificationPermission(!silent))) {
    // Same as the plugin path: drop anything pending rather than leave a
    // schedule the user can no longer be told about.
    await write("", "", false);
    return;
  }

  const payload = await buildReminderPayload(
    { ...getDefaultSettings(), ...settings },
    now
  );
  if (payload === null || payload.reminders.length === 0) {
    await write("", "", false);
    return;
  }

  await write(JSON.stringify(payload), JSON.stringify(payload.reminders), true);
}
