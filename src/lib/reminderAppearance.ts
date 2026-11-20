import type { ReminderChannelState } from "./nativeReminders";
import type { PrayerKey } from "./prayerReminders";

// Android's NotificationManager.IMPORTANCE_* values.
const IMPORTANCE_NONE = 0;
const IMPORTANCE_MIN = 1;
const IMPORTANCE_LOW = 2;
const IMPORTANCE_DEFAULT = 3;

/**
 * How Android shows one prayer's reminders, in words, from its channel's
 * importance. Null when there is nothing to say: no channel, or an Android
 * too old to have them.
 */
export function describeAppearance(
  state: ReminderChannelState | null,
  prayer: PrayerKey
): string | null {
  if (state === null) {
    return null;
  }
  if (!state.enabled) {
    return "Notifications are off for this app";
  }
  const importance = state.channels[prayer]?.importance;
  if (importance === undefined) {
    return null;
  }
  if (importance === IMPORTANCE_NONE) {
    return "Off in Android settings";
  }
  if (importance === IMPORTANCE_MIN) {
    return "No sound, minimised";
  }
  if (importance === IMPORTANCE_LOW) {
    return "No sound or pop-up";
  }
  if (importance === IMPORTANCE_DEFAULT) {
    return "Sound, no pop-up";
  }
  return "Sound and pop-up";
}
