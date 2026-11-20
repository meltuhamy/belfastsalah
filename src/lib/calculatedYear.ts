// Builds a calculated year in the shape of a src/prayer_data file: one row per
// calendar day, times in UTC. Like the files, every year has a 29 February
// row; in other years it repeats the 28th, and is never shown.
import type { PrayerDataRow } from "./PrayerTimeData";

export const hhmm = (date: Date) =>
  `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (year: number) => new Date(year, 1, 29).getMonth() === 1;

/**
 * `timesFor` gets the day as a Date built in the device's zone, because adhan
 * reads the calendar day with the local getters: it names the day, not a
 * moment. It returns the seven times after month and day (asr2 may be null).
 */
export function calculateYear(
  year: number,
  timesFor: (date: Date) => Array<string | null>
): Array<PrayerDataRow> {
  const leap = isLeapYear(year);
  const rows: Array<PrayerDataRow> = [];
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= DAYS_IN_MONTH[month - 1]; day++) {
      if (month === 2 && day === 29 && !leap) {
        rows.push(["2", "29", ...rows[rows.length - 1].slice(2)]);
        continue;
      }
      rows.push([
        String(month),
        String(day),
        ...timesFor(new Date(year, month - 1, day))
      ]);
    }
  }
  return rows;
}
