// London times, calculated on the device the way the London Unified Prayer
// Timetable calculates them (https://londonsalahtimes.com/technical/).
//
// The sun's position comes from adhan-js's implementation of Meeus,
// "Astronomical Algorithms". Its own PrayerTimes cannot be used as it stands:
// it interpolates the sun's position across three days for each event, while
// the timetable takes the position once, at 0h UT on the day, and derives
// every time of that day from it. Interpolating is more accurate, but it
// misses the published times by a minute on about a third of days.
//
// Fajr and Isha are not calculated by the timetable: they come from Hizbul
// Ulama's observations, and are a fixed number of minutes before sunrise and
// after Maghrib for each calendar day, the same every year (londonGaps.ts).
import Astronomical from "adhan/lib/esm/Astronomical";
import type { PrayerDataRow } from "./PrayerTimeData";
import { LONDON_FAJR_GAPS, LONDON_ISHA_GAPS } from "./londonGaps";

// Charing Cross.
const LATITUDE = 51.5073;
const LONGITUDE = -0.12755;

// Minutes the timetable moves each time by, to cover Greater London within
// the M25 and to keep Zuhr clear of zawal.
const ADJUST = { sunrise: -3, zuhr: 5, asr: 2, maghrib: 3 };

// The sun's upper limb on the horizon, refraction included.
const HORIZON = -0.833333;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const PHI = rad(LATITUDE);

// Meeus 25.3 and 28.3. adhan-js has neither the eccentricity nor the equation
// of time, so they are written here against its mean longitude and anomaly.
function equationOfTimeMinutes(T: number): number {
  const L0 = rad(Astronomical.meanSolarLongitude(T));
  const M = rad(Astronomical.meanSolarAnomaly(T));
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const epsilon = Astronomical.apparentObliquityOfTheEcliptic(
    T,
    Astronomical.meanObliquityOfTheEcliptic(T)
  );
  const y = Math.tan(rad(epsilon) / 2) ** 2;
  const E =
    y * Math.sin(2 * L0) -
    2 * e * Math.sin(M) +
    4 * e * y * Math.sin(M) * Math.cos(2 * L0) -
    0.5 * y * y * Math.sin(4 * L0) -
    1.25 * e * e * Math.sin(2 * M);
  return deg(E) * 4;
}

function declination(T: number): number {
  const epsilon = Astronomical.apparentObliquityOfTheEcliptic(
    T,
    Astronomical.meanObliquityOfTheEcliptic(T)
  );
  const lambda = Astronomical.apparentSolarLongitude(
    T,
    Astronomical.meanSolarLongitude(T)
  );
  return Math.asin(Math.sin(rad(epsilon)) * Math.sin(rad(lambda)));
}

// Minutes either side of transit at which the sun is at `altitude` degrees.
function hourAngleMinutes(altitude: number, delta: number): number {
  const cosH =
    (Math.sin(rad(altitude)) - Math.sin(PHI) * Math.sin(delta)) /
    (Math.cos(PHI) * Math.cos(delta));
  return deg(Math.acos(cosH)) * 4;
}

// The sun's altitude when a shadow is `shadowLength` times an object's height
// plus its noon shadow: 1 for the first Asr, 2 for the Hanafi one.
const asrAltitude = (shadowLength: number, delta: number) =>
  deg(Math.atan(1 / (shadowLength + Math.tan(Math.abs(PHI - delta)))));

export type LondonTimes = {
  sunrise: number;
  zuhr: number;
  asr: number;
  asr2: number;
  maghrib: number;
};

// The five calculated times for a day, in unrounded minutes after 0h UT.
export function londonTimes(
  year: number,
  month: number,
  day: number
): LondonTimes {
  const T = Astronomical.julianCentury(
    Astronomical.julianDay(year, month, day, 12)
  );
  const delta = declination(T);
  const transit = 720 - LONGITUDE * 4 - equationOfTimeMinutes(T);
  const sun = hourAngleMinutes(HORIZON, delta);
  return {
    sunrise: transit - sun + ADJUST.sunrise,
    zuhr: transit + ADJUST.zuhr,
    asr: transit + hourAngleMinutes(asrAltitude(1, delta), delta) + ADJUST.asr,
    asr2: transit + hourAngleMinutes(asrAltitude(2, delta), delta) + ADJUST.asr,
    maghrib: transit + sun + ADJUST.maghrib
  };
}

const hhmm = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

// The two days in 2027 to 2076 where the timetable's spreadsheet rounded a
// time within a few milliseconds of the half minute the other way from this
// calculation (which puts them at 07:19:29.999 and 12:15:29.9998). No bias in
// the rounding fixes both without breaking other days, so they are named.
const ROUNDING_OVERRIDES: Record<string, Partial<Record<keyof LondonTimes, number>>> = {
  "2057-2-10": { sunrise: 1 },
  "2064-3-10": { zuhr: 1 }
};

// The five calculated times for a day, rounded to the minute as the timetable
// publishes them.
function roundedLondonTimes(year: number, month: number, day: number): LondonTimes {
  const times = londonTimes(year, month, day);
  const overrides = ROUNDING_OVERRIDES[`${year}-${month}-${day}`] ?? {};
  return Object.fromEntries(
    Object.entries(times).map(([k, v]) => [
      k,
      Math.round(v) + (overrides[k as keyof LondonTimes] ?? 0)
    ])
  ) as LondonTimes;
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// A year in the shape of a src/prayer_data file: one row per calendar day,
// times in UTC. Like the files, every year has a 29 February row; in other
// years it repeats the 28th, and is never shown.
export function calculateLondonYear(year: number): Array<PrayerDataRow> {
  const leap = Astronomical.isLeapYear(year);
  const rows: Array<PrayerDataRow> = [];
  let index = 0;
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= DAYS_IN_MONTH[month - 1]; day++, index++) {
      if (month === 2 && day === 29 && !leap) {
        rows.push(["2", "29", ...rows[rows.length - 1].slice(2)]);
        continue;
      }
      const t = roundedLondonTimes(year, month, day);
      rows.push([
        String(month),
        String(day),
        hhmm(t.sunrise - LONDON_FAJR_GAPS[index]),
        hhmm(t.sunrise),
        hhmm(t.zuhr),
        hhmm(t.asr),
        hhmm(t.asr2),
        hhmm(t.maghrib),
        hhmm(t.maghrib + LONDON_ISHA_GAPS[index])
      ]);
    }
  }
  return rows;
}
