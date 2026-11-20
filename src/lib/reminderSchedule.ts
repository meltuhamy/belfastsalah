import { Prayer } from "./PrayerTimes";
import { OFFSET_LIMIT, REMINDER_PRAYERS } from "./prayerReminders";

// iOS will not keep more than 64 pending local notifications; the system
// drops the rest. That is about ten days of the six daily prayers, whatever
// the lead time: a longer lead only moves each prayer's one reminder
// earlier, it does not add a second one, so it neither shortens the window
// nor lengthens it. The last slot asks the user to open the app, which is
// what refills the window.
//
// Android no longer schedules through this limit. It writes several years of
// reminders and arms two days at a time (see reminderPayload.ts). The number
// stays so an upgrade can cancel the batch the plugin still has pending:
// ids 0 through this limit, including the old end-of-batch prompt.
export const IOS_NOTIFICATION_LIMIT = 64;
export const ANDROID_NOTIFICATION_LIMIT = 6 * 30 + 1;

/** The last entry of a written list, once there is nothing left to arm. */
export const REMINDERS_ENDED_TITLE = "Prayer reminders stop here";
export const REMINDERS_ENDED_BODY = "Open the app to keep them coming.";

export function reminderTitle(prayerName: string, clock: string): string {
  return `${prayerName} is at ${clock}`;
}

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
  // window can be filled again. Its `at` is the last prayer's own time, or
  // that prayer's reminder when it comes after.
  prayer: Prayer | null;
  prayerTime: Date | null;
  // Minutes from the prayer: negative before, positive after. 0 on the final slot.
  offset: number;
};

/** A prayer's reminder timing, or null when that prayer has none. */
export type ReminderTiming = { offset: number } | null;

/**
 * The notifications to schedule from `now`.
 *
 * Each prayer is reminded at its own offset, before or after it, or not at
 * all. The walk starts half an hour back, so a prayer that has just passed
 * still gets a reminder set to follow it. A reminder whose time has already
 * gone is left out, so it does not take a slot that could hold a later one.
 * One slot is kept for the prompt at the end.
 */
export async function planReminders(
  limit: number,
  now: Date,
  getNext: (from: Date) => Promise<NextPrayer>,
  timingFor: (prayer: Prayer) => ReminderTiming
): Promise<ReminderSlot[]> {
  const found: Array<Omit<ReminderSlot, "id">> = [];
  let cursor = new Date(now.getTime() - (OFFSET_LIMIT + 1) * 60_000);
  // Every prayer turned off would otherwise walk forever.
  const maxPrayers = limit * REMINDER_PRAYERS.length + REMINDER_PRAYERS.length;
  for (let seen = 0; found.length < limit - 1 && seen < maxPrayers; seen++) {
    const next = await getNext(cursor);
    if (next.time.getTime() <= cursor.getTime()) {
      break;
    }
    cursor = next.time;
    const timing = timingFor(next.prayer);
    if (timing === null) {
      continue;
    }
    const at = new Date(next.time.getTime() + timing.offset * 60_000);
    if (at.getTime() <= now.getTime()) {
      continue;
    }
    found.push({ at, prayer: next.prayer, prayerTime: next.time, offset: timing.offset });
  }
  if (found.length === 0) {
    return [];
  }
  found.sort((a, b) => a.at.getTime() - b.at.getTime());
  const slots: ReminderSlot[] = found.map((slot, id) => ({ ...slot, id }));
  slots.push({
    id: limit,
    // The later of the last prayer and the last reminder, which can follow it.
    at: new Date(Math.max(cursor.getTime(), found[found.length - 1].at.getTime())),
    prayer: null,
    prayerTime: null,
    offset: 0,
  });
  return slots;
}
