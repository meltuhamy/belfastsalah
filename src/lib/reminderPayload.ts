/**
 * The reminder list Android keeps, and rearms from, without the app open.
 *
 * Same split as the widget payload: TypeScript decides every instant and
 * every title, and the native side only stores the JSON and shows it. Titles
 * are already formatted in the display zone. The phone must not work them
 * out again - a lock screen that disagreed with the app would be worse than
 * a reminder that asked to be refreshed.
 *
 * Five years is long enough that the list runs out only if the app is never
 * opened again. The native side arms two days of it at a time.
 */

import { getDaysInMonth } from "date-fns";
import { AppSettings } from "./settings";
import { locationTimeZones } from "./PrayerTimeData";
import {
  createPrayerTimes,
  prayerToString,
  PrayerDayTimes,
  PrayerTimes,
} from "./PrayerTimes";
import { resolveDisplayTimeZone } from "./displayZone";
import { getZonedDateParts, formatTimeInZone, middayOn } from "./timeZone";
import {
  REMINDERS_ENDED_BODY,
  REMINDERS_ENDED_TITLE,
  reminderBody,
  reminderTitle,
} from "./reminderSchedule";

/** Bump when the shape changes, so an old install ignores a list it cannot read. */
export const REMINDER_PAYLOAD_VERSION = 1;

/**
 * How far ahead to write. 5 * 365 days is about 11,000 prayers: a day short
 * of five calendar years when a leap day falls inside, which is still the
 * horizon the native store is sized for.
 */
export const REMINDER_HORIZON_DAYS = 5 * 365;

export type ReminderEntry = {
  /** Epoch milliseconds. When the notification fires, not when the prayer is. */
  at: number;
  title: string;
  body: string;
};

export type ReminderPayload = {
  version: number;
  generatedAt: number;
  reminders: Array<ReminderEntry>;
};

/**
 * Builds the list, or null before a location has been chosen.
 *
 * One entry per prayer still inside the horizon, then a single prompt at the
 * last prayer's own time. Passed reminders are left out, as they are on iOS:
 * a prayer closer than the lead time does not take an entry.
 */
export async function buildReminderPayload(
  settings: AppSettings,
  now: Date,
  horizonDays: number = REMINDER_HORIZON_DAYS,
  deviceTimeZone?: string
): Promise<ReminderPayload | null> {
  if (settings.location === null) {
    return null;
  }
  const prayerTimes = createPrayerTimes(settings.location, settings.asrMethod);
  const displayZone = resolveDisplayTimeZone(settings, deviceTimeZone);
  const timetableZone = locationTimeZones[settings.location];
  const horizonEnd = now.getTime() + horizonDays * 24 * 60 * 60 * 1000;
  const body = reminderBody(settings.notifyMinutes);
  const leadMs = settings.notifyMinutes * 60_000;

  const reminders: Array<ReminderEntry> = [];
  let lastPrayerAt: number | null = null;

  const today = getZonedDateParts(now, timetableZone);
  let year = today.year;
  let month = today.month - 1;

  while (Date.UTC(year, month, 1) <= horizonEnd) {
    const monthDays = await daysIn(prayerTimes, year, month);
    let pastHorizon = false;

    for (const dayTimes of monthDays) {
      if (dayTimes === null) {
        continue;
      }
      for (const prayerTime of dayTimes) {
        const atPrayer = prayerTime.time.getTime();
        if (atPrayer <= now.getTime()) {
          continue;
        }
        if (atPrayer > horizonEnd) {
          pastHorizon = true;
          break;
        }
        lastPrayerAt = atPrayer;
        const fireAt = atPrayer - leadMs;
        if (fireAt <= now.getTime()) {
          continue;
        }
        reminders.push({
          at: fireAt,
          title: reminderTitle(
            prayerToString(prayerTime.prayer),
            formatTimeInZone(prayerTime.time, displayZone)
          ),
          body,
        });
      }
      if (pastHorizon) {
        break;
      }
    }

    if (pastHorizon) {
      break;
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  if (lastPrayerAt !== null && lastPrayerAt > now.getTime()) {
    reminders.push({
      at: lastPrayerAt,
      title: REMINDERS_ENDED_TITLE,
      body: REMINDERS_ENDED_BODY,
    });
  }

  return {
    version: REMINDER_PAYLOAD_VERSION,
    generatedAt: now.getTime(),
    reminders,
  };
}

/**
 * One month of days, or null for a day the timetable has no row for.
 *
 * Belfast ships a single non-leap year and is asked for every year, so a
 * leap day's lookup has nothing to return. Skipping that day keeps the other
 * five years intact; failing the month would throw the list away.
 */
async function daysIn(
  prayerTimes: PrayerTimes,
  year: number,
  month: number
): Promise<Array<PrayerDayTimes | null>> {
  try {
    return await prayerTimes.getMonth(month, year);
  } catch {
    const count = getDaysInMonth(new Date(Date.UTC(year, month, 1, 12)));
    const days: Array<PrayerDayTimes | null> = [];
    for (let day = 1; day <= count; day++) {
      try {
        days.push(await prayerTimes.getDay(middayOn(year, month, day)));
      } catch {
        days.push(null);
      }
    }
    return days;
  }
}
