// Istanbul times, calculated on the device by adhanfork's Diyanet method:
// Turkey's Presidency of Religious Affairs, whose times Istanbul's mosques
// follow (namazvakitleri.diyanet.gov.tr, district 9541). It reproduces every
// time of Diyanet's 2026 Istanbul table, and matches 99.7% of them without
// that year's 7 listed corrections, which is what later years get until their
// tables are checked.
import { CalculationMethod, Coordinates, PrayerTimes } from "adhanfork";
import type { PrayerDataRow } from "./PrayerTimeData";
import { calculateYear, hhmm } from "./calculatedYear";

// Diyanet's reference point for Istanbul, fitted to its table: other points in
// the city move times by up to a minute.
const ISTANBUL = new Coordinates(41.014, 28.972);

const diyanet = CalculationMethod.Diyanet();

// Diyanet publishes one Asr, by the Shafi'i shadow length, so the second asr
// column is empty: Istanbul does not offer Hanafi Asr (supportsHanafiAsr).
export function calculateIstanbulYear(year: number): Array<PrayerDataRow> {
  return calculateYear(year, date => {
    const times = new PrayerTimes(ISTANBUL, date, diyanet);
    return [
      hhmm(times.fajr),
      hhmm(times.sunrise),
      hhmm(times.dhuhr),
      hhmm(times.asr),
      null,
      hhmm(times.maghrib),
      hhmm(times.isha)
    ];
  });
}
