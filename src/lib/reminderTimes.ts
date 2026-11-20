import { formatClockTime } from "./timeFormat";

/**
 * "Fajr: 5:42. Reminder: 5:32" - today's prayer and when its reminder goes,
 * on the clock the app shows.
 */
export function reminderTimesLine(
  prayerName: string,
  prayerTime: Date,
  offset: number,
  zone: string,
  twentyFourHour: boolean
): string {
  const at = new Date(prayerTime.getTime() + offset * 60_000);
  const clock = (d: Date) => formatClockTime(d, zone, twentyFourHour);
  return `${prayerName}: ${clock(prayerTime)}. Reminder: ${clock(at)}`;
}
