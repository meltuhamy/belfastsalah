// London times, calculated on the device by adhan-js's London Unified Prayer
// Timetable method (https://londonsalahtimes.com/technical/), which
// reproduces the timetable's published times to the minute.
import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from "adhanfork";
import type { PrayerDataRow } from "./PrayerTimeData";
// The extension is needed: .cursor/skills/verify-london-prayer-times loads
// this module with Node's own type stripping, which resolves no extensionless
// imports.
import { calculateYear, hhmm } from "./calculatedYear.ts";

// The timetable's reference point, Charing Cross. The method's adjustments
// cover Greater London from here; any other point moves times by up to a
// minute.
const CHARING_CROSS = new Coordinates(51.5073, -0.12755);

const shafi = CalculationMethod.LondonUnified();
const hanafi = CalculationMethod.LondonUnified();
hanafi.madhab = Madhab.Hanafi;

export function calculateLondonYear(year: number): Array<PrayerDataRow> {
  return calculateYear(year, date => {
    const times = new PrayerTimes(CHARING_CROSS, date, shafi);
    const asr2 = new PrayerTimes(CHARING_CROSS, date, hanafi).asr;
    return [
      hhmm(times.fajr),
      hhmm(times.sunrise),
      hhmm(times.dhuhr),
      hhmm(times.asr),
      hhmm(asr2),
      hhmm(times.maghrib),
      hhmm(times.isha)
    ];
  });
}
