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
  Prayer,
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
export const WIDGET_PAYLOAD_VERSION = 3;

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
  /** Index into `days` of the day this prayer belongs to. */
  day: number;
};

export type WidgetDay = {
  /** e.g. "Sun 15 Feb", in the display zone. */
  dateLabel: string;
  prayers: Array<WidgetPrayer>;
};

export type WidgetPayload = {
  version: number;
  generatedAt: number;
  locationLabel: string;
  /**
   * Today and every day after it that `upcoming` reaches into.
   *
   * A widget shows the day of the prayer it is counting down to, so it moves
   * on by itself at each prayer boundary - after Isha to tomorrow, just as the
   * app's strip does - rather than showing whichever day the app was last
   * opened on.
   */
  days: Array<WidgetDay>;
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
  const days: Array<WidgetDay> = [];
  let reachedToday = false;

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
        reachedToday = true;
      }
      if (!reachedToday) {
        continue;
      }

      const ahead = dayTimes.filter((p) => {
        const at = p.time.getTime();
        return at > now.getTime() && at <= horizonEnd;
      });
      // Today is always carried; a later day only if a prayer in it is.
      if (days.length > 0 && ahead.length === 0) {
        continue;
      }

      const index = days.length;
      days.push({
        // Dated by its midday prayer: the instant least likely to fall on a
        // different date in the zone the user reads times in.
        dateLabel: formatDateInZone(dayTimes[Prayer.Duhr].time, displayZone),
        prayers: dayTimes.map((p) => ({
          name: prayerToString(p.prayer),
          time: formatTimeInZone(p.time, displayZone),
        })),
      });
      for (const prayerTime of ahead) {
        upcoming.push({
          name: prayerToString(prayerTime.prayer),
          at: prayerTime.time.getTime(),
          time: formatTimeInZone(prayerTime.time, displayZone),
          day: index,
        });
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
    days,
    upcoming,
  };
}
