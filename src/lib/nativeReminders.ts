import { Capacitor, registerPlugin } from "@capacitor/core";
import { AppSettings, getDefaultSettings } from "./settings";
import {
  buildReminderPayload,
  REMINDER_HORIZON_DAYS,
  reminderChannels,
} from "./reminderPayload";
import type { PrayerKey, PrayerReminders } from "./prayerReminders";
import { ReminderSound } from "./reminderSound";
import { getDeviceUses24Hour } from "./deviceTimeFormat";
import {
  announceReminderChange,
  ensureNotificationPermission,
} from "./notifications";

type PrayerRemindersPlugin = {
  /** Replaces the stored list. An empty payload clears it and the alarms. */
  sync(options: { payload: string }): Promise<void>;
  /**
   * Brings each prayer's notification channel up to its sound, and says how
   * each one appears in Android's settings now.
   */
  ensureChannels(options: {
    sounds: Record<PrayerKey, ReminderSound>;
  }): Promise<ReminderChannelState>;
  /** Opens Android's settings page for one prayer's channel. */
  openChannelSettings(options: { prayer: PrayerKey }): Promise<void>;
  /**
   * Plays the phone's notification sound: Android's own, or iOS's standard
   * tone. The only methods iOS has.
   */
  playDefaultSound(): Promise<void>;
  stopDefaultSound(): Promise<void>;
};

/** One prayer's channel: its id, and Android's importance for it. */
export type ReminderChannel = { id: string; importance?: number };

export type ReminderChannelState = {
  /** False when notifications are off for the whole app. */
  enabled: boolean;
  /** Empty before Android 8, which has no channels. */
  channels: Partial<Record<PrayerKey, ReminderChannel>>;
};

const PrayerReminders = registerPlugin<PrayerRemindersPlugin>("PrayerReminders");

type ReminderSettings = Pick<
  AppSettings,
  | "notify"
  | "reminders"
  | "location"
  | "asrMethod"
  | "showTimesInDeviceZone"
  | "timeFormat"
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
    now,
    REMINDER_HORIZON_DAYS,
    undefined,
    getDeviceUses24Hour()
  );
  if (payload === null || payload.reminders.length === 0) {
    await write("", "", false);
    return;
  }

  await write(JSON.stringify(payload), JSON.stringify(payload.reminders), true);
}

/**
 * Android only: makes each prayer's channel match its sound, and reads how
 * each appears. Null elsewhere.
 */
export async function ensureReminderChannels(
  reminders: PrayerReminders
): Promise<ReminderChannelState | null> {
  if (Capacitor.getPlatform() !== "android") {
    return null;
  }
  return PrayerReminders.ensureChannels({
    sounds: reminderChannels({ reminders }),
  });
}

/** Apps only: plays the sound "Default sound" reminders make. */
export async function playDefaultSound(): Promise<void> {
  await PrayerReminders.playDefaultSound();
}

export async function stopDefaultSound(): Promise<void> {
  await PrayerReminders.stopDefaultSound();
}

/** Android only: opens the system settings for one prayer's notifications. */
export async function openReminderChannelSettings(prayer: PrayerKey): Promise<void> {
  await PrayerReminders.openChannelSettings({ prayer });
}
