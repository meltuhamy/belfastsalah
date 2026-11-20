// London times, calculated on the device by adhan-js's London Unified Prayer
// Timetable method (https://londonsalahtimes.com/technical/), which
// reproduces the timetable's published times to the minute.
import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from "adhanfork";
import type { PrayerDataRow } from "./PrayerTimeData";

// The timetable's reference point, Charing Cross. The method's adjustments
// cover Greater London from here; any other point moves times by up to a
// minute.
const CHARING_CROSS = new Coordinates(51.5073, -0.12755);

const shafi = CalculationMethod.LondonUnified();
const hanafi = CalculationMethod.LondonUnified();
hanafi.madhab = Madhab.Hanafi;

const hhmm = (date: Date) =>
  `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (year: number) => new Date(year, 1, 29).getMonth() === 1;

// A year in the shape of a src/prayer_data file: one row per calendar day,
// times in UTC. Like the files, every year has a 29 February row; in other
// years it repeats the 28th, and is never shown.
export function calculateLondonYear(year: number): Array<PrayerDataRow> {
  const leap = isLeapYear(year);
  const rows: Array<PrayerDataRow> = [];
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= DAYS_IN_MONTH[month - 1]; day++) {
      if (month === 2 && day === 29 && !leap) {
        rows.push(["2", "29", ...rows[rows.length - 1].slice(2)]);
        continue;
      }
      // adhan reads the calendar day with the local getters, so the date is
      // built in the device's zone: it names the day, not a moment.
      const date = new Date(year, month - 1, day);
      const times = new PrayerTimes(CHARING_CROSS, date, shafi);
      const asr2 = new PrayerTimes(CHARING_CROSS, date, hanafi).asr;
      rows.push([
        String(month),
        String(day),
        hhmm(times.fajr),
        hhmm(times.sunrise),
        hhmm(times.dhuhr),
        hhmm(times.asr),
        hhmm(asr2),
        hhmm(times.maghrib),
        hhmm(times.isha)
      ]);
    }
  }
  return rows;
}
