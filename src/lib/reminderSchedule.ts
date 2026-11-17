import { subMinutes } from "date-fns";
import { Prayer } from "./PrayerTimes";

// iOS will not keep more than 64 pending local notifications; the system
// drops the rest. That is about ten days of the six daily prayers, whatever
// the lead time: a longer lead only moves each prayer's one reminder
// earlier, it does not add a second one, so it neither shortens the window
// nor lengthens it. The last slot asks the user to open the app, which is
// what refills the window. AlarmManager allows 500 pending alarms per app,
// and the widget redraw already uses one, so a month of prayers fits on
// Android with room to spare.
export const IOS_NOTIFICATION_LIMIT = 64;
export const ANDROID_NOTIFICATION_LIMIT = 6 * 30 + 1;

export function notificationLimit(platform: string): number {
  return platform === "android"
    ? ANDROID_NOTIFICATION_LIMIT
    : IOS_NOTIFICATION_LIMIT;
}

export type NextPrayer = {
  prayer: Prayer;
  time: Date;
};

export type ReminderSlot = {
  id: number;
  at: Date;
  // Null on the final slot, which asks the user to open the app so the
  // window can be filled again. Its `at` is the last prayer's own time.
  prayer: Prayer | null;
  prayerTime: Date | null;
};

/**
 * The notifications to schedule from `now`.
 *
 * One slot is kept for the prompt at the end. A reminder whose time has
 * already passed (the next prayer is closer than `minutesBefore`) is left
 * out, so it does not take a slot that could hold a later prayer.
 */
export async function planReminders(
  limit: number,
  minutesBefore: number,
  now: Date,
  getNext: (from: Date) => Promise<NextPrayer>
): Promise<ReminderSlot[]> {
  const slots: ReminderSlot[] = [];
  let cursor = now;
  let id = 0;
  while (slots.length < limit - 1) {
    const next = await getNext(cursor);
    if (next.time.getTime() <= cursor.getTime()) {
      break;
    }
    const at = subMinutes(next.time, minutesBefore);
    cursor = next.time;
    if (at.getTime() <= now.getTime()) {
      continue;
    }
    slots.push({ id, at, prayer: next.prayer, prayerTime: next.time });
    id += 1;
  }
  slots.push({
    id: limit,
    at: cursor,
    prayer: null,
    prayerTime: null,
  });
  return slots;
}
