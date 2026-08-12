/**
 * What the home screen widgets are given to draw.
 *
 * The widget is native - a launcher-inflated RemoteViews tree - so none of the
 * app's rendering can be reused. Rather than reimplement the timetable in
 * Kotlin and end up with two copies of "which row is today" that can disagree,
 * the app computes everything here and the widget only binds fields to views.
 *
 * That is why each prayer appears twice over. `time` is a display string,
 * already formatted in whichever zone the user reads times in, and goes
 * straight into a TextView. `at` is a UTC instant, which has no timezone to
 * get wrong, and is only ever used as the base for the countdown. The native
 * side never does date arithmetic.
 */

import {
  BelfastPrayerTimes,
  LondonPrayerTimes,
  PrayerLocation,
  PrayerTimes,
  prayerToString,
} from "./PrayerTimes";
import { locationNames, locationTimeZones } from "./PrayerTimeData";
import { AppSettings } from "./settings";
import { resolveDisplayTimeZone } from "./displayZone";
import {
  formatDateInZone,
  formatTimeInZone,
  getZonedDateParts,
} from "./timeZone";

/** Bump when the shape changes, so an old widget ignores a payload it cannot read. */
export const WIDGET_PAYLOAD_VERSION = 2;

/** How far ahead to write, so the widget survives the app going unopened. */
export const DEFAULT_HORIZON_DAYS = 90;

export type WidgetPrayer = {
  name: string;
  /** Formatted in the user's display zone, e.g. "05:36". */
  time: string;
};

export type WidgetUpcoming = {
  name: string;
  /** Epoch milliseconds. The countdown's base. */
  at: number;
  /**
   * The same instant as a display string. Carried per entry, not just for
   * today, because a widget set to show the time rather than a countdown
   * still needs it when the next prayer is tomorrow's Fajr.
   */
  time: string;
};

export type WidgetPayload = {
  version: number;
  generatedAt: number;
  locationLabel: string;
  today: {
    /** e.g. "Sun 15 Feb", in the display zone. */
    dateLabel: string;
    prayers: Array<WidgetPrayer>;
  };
  /** Every prayer still to come within the horizon, earliest first. */
  upcoming: Array<WidgetUpcoming>;
};

function prayerTimesFor(settings: AppSettings): PrayerTimes | null {
  if (settings.location === null) {
    return null;
  }
  return settings.location === PrayerLocation.London
    ? new LondonPrayerTimes(settings.asrMethod)
    : new BelfastPrayerTimes();
}

/**
 * Builds the payload, or null before a location has been chosen.
 *
 * Days are counted in the timetable's zone and clock times rendered in the
 * display zone, exactly as the today card does - so the widget and the app
 * cannot disagree about either.
 */
export async function buildWidgetPayload(
  settings: AppSettings | null,
  now: Date,
  horizonDays: number = DEFAULT_HORIZON_DAYS
): Promise<WidgetPayload | null> {
  if (settings == null || settings.location === null) {
    return null;
  }
  const prayerTimes = prayerTimesFor(settings);
  if (prayerTimes === null) {
    return null;
  }

  const displayZone = resolveDisplayTimeZone(settings);
  const timetableZone = locationTimeZones[settings.location];
  const todayParts = getZonedDateParts(now, timetableZone);
  const horizonEnd = now.getTime() + horizonDays * 24 * 60 * 60 * 1000;

  const upcoming: Array<WidgetUpcoming> = [];
  let today: Array<WidgetPrayer> = [];

  // Walk whole months from today's. getMonth already takes its day count from
  // the calendar rather than the data file, which is what keeps a non-leap
  // year's phantom 29 February out of the payload.
  //
  // The loop is bounded by where each month *starts*, not by what has been
  // collected: entries past the horizon are never appended, so a condition
  // looking at the last collected time would never be satisfied.
  let year = todayParts.year;
  let month = todayParts.month - 1; // getMonth is 0-indexed

  while (Date.UTC(year, month, 1) <= horizonEnd) {
    const monthDays = await prayerTimes.getMonth(month, year);

    for (let day = 1; day <= monthDays.length; day++) {
      const dayTimes = monthDays[day - 1];

      if (
        year === todayParts.year &&
        month === todayParts.month - 1 &&
        day === todayParts.day
      ) {
        today = dayTimes.map((p) => ({
          name: prayerToString(p.prayer),
          time: formatTimeInZone(p.time, displayZone),
        }));
      }

      for (const prayerTime of dayTimes) {
        const at = prayerTime.time.getTime();
        if (at > now.getTime() && at <= horizonEnd) {
          upcoming.push({
            name: prayerToString(prayerTime.prayer),
            at,
            time: formatTimeInZone(prayerTime.time, displayZone),
          });
        }
      }
    }

    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return {
    version: WIDGET_PAYLOAD_VERSION,
    generatedAt: now.getTime(),
    locationLabel: locationNames[settings.location],
    today: {
      dateLabel: formatDateInZone(now, displayZone),
      prayers: today,
    },
    upcoming,
  };
}
