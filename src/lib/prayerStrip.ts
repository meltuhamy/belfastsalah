/**
 * Which day the strip of six times is showing, and whether to say so.
 *
 * Pure so the rules can be tested against an arbitrary clock and zone: the
 * interesting cases are all around midnight and around the last prayer of the
 * day, neither of which is convenient to reach by waiting.
 */

import { Prayer, PrayerDayTimes, PrayerTime } from "./PrayerTimes";
import { getZonedDateParts } from "./timeZone";

/**
 * Whether the next prayer has fallen off the end of the day on screen.
 *
 * True between the last prayer of a day and midnight, when the next prayer is
 * the following day's Fajr. Decided by comparing instants rather than dates
 * because it is exactly the question the strip needs answered - the day's own
 * times are already to hand, so no zone reasoning is involved.
 */
export function nextIsAfterDay(
  day: PrayerDayTimes | null,
  next: PrayerTime | null
): boolean {
  if (day == null || next == null) {
    return false;
  }
  return next.time.getTime() > day[Prayer.Isha].time.getTime();
}

/**
 * Whether `instant` lands on a later calendar day than `now` does, read in
 * `timeZone`.
 *
 * This is what the "Tomorrow" badge is for, and it has to be asked in the zone
 * the times are being rendered in rather than the timetable's. Someone in
 * Dubai reading London times at 23:30 London is already on the next day
 * themselves, so the strip's times are not tomorrow's to them and the badge
 * would be a lie. Only ever looks forwards: a day that reads as earlier is the
 * same situation seen from the other side, and needs no badge either.
 */
export function isLaterDay(
  instant: Date,
  now: Date,
  timeZone: string
): boolean {
  return dayNumber(instant, timeZone) > dayNumber(now, timeZone);
}

/** A calendar date as one comparable number, e.g. 20260215. */
function dayNumber(instant: Date, timeZone: string): number {
  const { year, month, day } = getZonedDateParts(instant, timeZone);
  return year * 10_000 + month * 100 + day;
}
