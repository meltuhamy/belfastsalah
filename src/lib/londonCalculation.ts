import type { PrayerDataRow } from "./PrayerTimeData";

/**
 * Astronomical calculation of London prayer times.
 *
 * Implements the London Unified Prayer Timetable methodology:
 * https://londonsalahtimes.com/technical/
 *
 * Uses algorithms from Jean Meeus, 'Astronomical Algorithms' (2nd ed. 1998):
 * - Coordinates: Charing Cross (51.5073° N, 0.12755° W)
 * - Adjustments to cover the Greater London M25 region and avoid Zawal:
 *     Sunrise: 3 minutes earlier (-3 min)
 *     Zuhr: 5 minutes later (+5 min)
 *     'Asr (Shafi & Hanafi): 2 minutes later (+2 min)
 *     Sunset / Maghrib: 3 minutes later (+3 min)
 * - Fajr and Isha: derived from UK observational data (Hizbul Ulama) as fixed
 *   gap minutes relative to Sunrise and Maghrib for each day of the year (366 days).
 * - Every London year includes a 29 February row (in non-leap years it repeats 28 February).
 */

const LAT = 51.5073;
const LON = -0.12755;
const PHI = (LAT * Math.PI) / 180.0;
const SIN_PHI = Math.sin(PHI);
const COS_PHI = Math.cos(PHI);
const SIN_H0 = Math.sin((-0.833333 * Math.PI) / 180.0);

// 366-entry gap table: [fajrGap, ishaGap] for each day of the year (including 29 Feb).
// Fajr = Sunrise - fajrGap; Isha = Maghrib + ishaGap.
const LONDON_GAP_TABLE = new Uint8Array([
  97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97,
  97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97,
  97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97,
  97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 96,
  97, 95, 97, 94, 97, 94, 97, 93, 97, 93, 97, 92, 97, 92, 97, 91,
  97, 91, 97, 91, 97, 91, 97, 90, 97, 90, 97, 90, 97, 90, 97, 89,
  97, 89, 97, 89, 97, 89, 97, 88, 97, 88, 97, 88, 97, 88, 97, 87,
  97, 87, 97, 87, 97, 87, 97, 86, 97, 86, 97, 86, 97, 85, 97, 85,
  97, 84, 97, 84, 97, 83, 97, 83, 97, 82, 97, 82, 97, 82, 97, 82,
  97, 81, 97, 81, 97, 81, 97, 81, 97, 80, 97, 80, 97, 80, 96, 80,
  96, 79, 95, 79, 95, 79, 95, 79, 95, 78, 94, 78, 94, 78, 93, 78,
  93, 77, 93, 77, 92, 77, 92, 77, 92, 77, 92, 76, 92, 76, 92, 76,
  92, 76, 92, 76, 92, 76, 92, 75, 92, 75, 92, 75, 92, 75, 92, 75,
  92, 75, 92, 75, 92, 75, 92, 74, 93, 74, 93, 74, 93, 74, 94, 74,
  94, 74, 94, 73, 95, 73, 95, 73, 95, 72, 96, 72, 96, 72, 96, 71,
  97, 71, 98, 71, 98, 71, 99, 71, 99, 71, 100, 71, 100, 71, 101, 71,
  101, 71, 102, 71, 102, 71, 103, 71, 103, 71, 104, 70, 104, 70, 105, 70,
  105, 71, 106, 71, 106, 71, 107, 72, 107, 72, 108, 72, 108, 73, 109, 73,
  110, 73, 111, 74, 111, 74, 112, 74, 112, 75, 113, 75, 113, 75, 114, 76,
  114, 76, 115, 77, 115, 77, 116, 77, 116, 78, 117, 78, 117, 78, 118, 78,
  118, 79, 119, 79, 119, 80, 120, 80, 121, 81, 121, 81, 121, 81, 121, 81,
  121, 80, 121, 79, 121, 79, 120, 79, 120, 78, 120, 77, 119, 77, 119, 76,
  119, 76, 118, 76, 118, 75, 117, 75, 117, 74, 117, 73, 116, 72, 115, 72,
  115, 72, 114, 71, 114, 71, 114, 71, 113, 70, 113, 70, 112, 70, 112, 69,
  112, 69, 111, 69, 111, 68, 110, 68, 110, 68, 110, 67, 109, 67, 109, 67,
  108, 66, 108, 66, 108, 66, 107, 65, 107, 65, 106, 65, 106, 64, 105, 64,
  105, 64, 104, 63, 104, 63, 103, 63, 103, 63, 102, 64, 102, 64, 101, 64,
  101, 64, 100, 64, 100, 65, 100, 65, 99, 65, 99, 65, 99, 65, 98, 66,
  98, 66, 98, 66, 97, 66, 97, 66, 97, 67, 96, 67, 96, 67, 96, 67,
  95, 67, 95, 68, 95, 68, 94, 68, 94, 68, 94, 69, 93, 69, 93, 69,
  93, 69, 92, 70, 92, 70, 92, 70, 92, 71, 92, 71, 92, 71, 92, 72,
  92, 72, 92, 72, 92, 73, 92, 73, 92, 73, 92, 73, 92, 74, 92, 74,
  92, 74, 92, 74, 92, 75, 91, 75, 91, 75, 91, 75, 90, 75, 90, 75,
  90, 76, 89, 76, 89, 76, 89, 76, 88, 77, 88, 77, 88, 77, 87, 77,
  87, 77, 87, 77, 88, 78, 88, 78, 88, 79, 88, 79, 89, 79, 89, 79,
  89, 81, 90, 81, 90, 81, 90, 81, 91, 81, 91, 81, 91, 83, 92, 83,
  92, 83, 92, 83, 93, 83, 93, 83, 93, 83, 93, 83, 94, 85, 94, 85,
  95, 85, 95, 85, 95, 87, 96, 87, 96, 87, 96, 87, 97, 87, 97, 87,
  97, 87, 97, 88, 97, 88, 97, 89, 98, 89, 98, 90, 98, 90, 99, 91,
  99, 91, 99, 92, 100, 92, 100, 92, 100, 92, 101, 93, 101, 93, 101, 93,
  102, 93, 102, 94, 102, 94, 102, 94, 102, 94, 102, 95, 102, 95, 102, 95,
  102, 95, 102, 96, 102, 96, 102, 96, 102, 96, 102, 97, 102, 97, 102, 97,
  102, 97, 102, 97, 102, 97, 102, 97, 102, 97, 102, 97, 102, 97, 102, 97,
  102, 97, 102, 97, 102, 97, 102, 97, 102, 97, 102, 97, 101, 97, 101, 97,
  101, 97, 101, 97, 100, 97, 100, 97, 100, 97, 100, 97, 100, 97, 100, 97,
  98, 97, 98, 97, 98, 97, 97, 97, 97, 97, 97, 97,
]);

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function formatMinutes(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return pad(Math.floor(wrapped / 60)) + ":" + pad(wrapped % 60);
}

export function calculateLondonPrayerTimes(year: number): Array<PrayerDataRow> {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const rows: Array<PrayerDataRow> = [];
  let gapIdx = 0;

  for (let month = 1; month <= 12; month++) {
    let daysInMonth = 31;
    if (month === 4 || month === 6 || month === 9 || month === 11) {
      daysInMonth = 30;
    } else if (month === 2) {
      daysInMonth = isLeap ? 29 : 28;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      let y = year;
      let m = month;
      if (m <= 2) {
        y -= 1;
        m += 12;
      }
      const A = Math.floor(y / 100);
      const B = 2 - A + Math.floor(A / 4);
      const jd =
        Math.floor(365.25 * (y + 4716)) +
        Math.floor(30.6001 * (m + 1)) +
        day +
        B -
        1524;
      const T = (jd - 2451545.0) / 36525.0;
      const r = T / 10.0;

      // Sun's mean longitude (Meeus p. 183)
      const L0 =
        (280.4664567 + 360007.6982779 * r + 0.03032028 * r * r) % 360.0;

      // Sun's mean anomaly (Meeus p. 338)
      const M =
        (357.5291092 +
          35999.0502909 * T -
          0.0001536 * T * T -
          (T * T * T) / 24490000.0) %
        360.0;
      const Mr = (M * Math.PI) / 180.0;

      // Eccentricity (Meeus p. 151)
      const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;

      // Equation of centre (Meeus p. 164)
      const C =
        (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) +
        (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
        0.000289 * Math.sin(3 * Mr);
      const odot = L0 + C;

      // Apparent longitude (Meeus p. 164)
      const lambda_sun =
        odot -
        0.00569 -
        0.00478 * Math.sin(((125.04 - 1934.136 * T) * Math.PI) / 180.0);

      // Obliquity of the ecliptic (Meeus p. 147, 165)
      const eps0 =
        23.43929111111111 -
        (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600.0;
      const eps =
        eps0 + 0.00256 * Math.cos(((125.04 - 1934.136 * T) * Math.PI) / 180.0);
      const eps_r = (eps * Math.PI) / 180.0;
      const lambda_r = (lambda_sun * Math.PI) / 180.0;

      // Declination (Meeus p. 165)
      const sin_delta = Math.sin(eps_r) * Math.sin(lambda_r);
      const delta = Math.asin(sin_delta);
      const cos_delta = Math.cos(delta);

      // Equation of time (Meeus p. 184-185)
      const y_tan = Math.pow(Math.tan(eps_r / 2.0), 2);
      const L0_r = (L0 * Math.PI) / 180.0;
      const E =
        y_tan * Math.sin(2 * L0_r) -
        2 * e * Math.sin(Mr) +
        4 * e * y_tan * Math.sin(Mr) * Math.cos(2 * L0_r) -
        0.5 * y_tan * y_tan * Math.sin(4 * L0_r) -
        1.25 * e * e * Math.sin(2 * Mr);
      const E_deg = (E * 180.0) / Math.PI;

      // Solar noon in hours (Meeus p. 102)
      const m0 = 12.0 - LON / 15.0 - E_deg / 15.0;

      // Sunrise & sunset hour angle (Meeus p. 102)
      const cos_H = (SIN_H0 - SIN_PHI * sin_delta) / (COS_PHI * cos_delta);
      const H = (Math.acos(cos_H) * 180.0) / Math.PI;
      const Sr = m0 - H / 15.0;
      const Ss = m0 + H / 15.0;

      // Asr hour angles: Shafi (shadow = 1 + noon) & Hanafi (shadow = 2 + noon)
      const alt1 = Math.atan(1.0 / (1.0 + Math.tan(PHI - delta)));
      const cos_H_asr1 =
        (Math.sin(alt1) - SIN_PHI * sin_delta) / (COS_PHI * cos_delta);
      const H_asr1 = (Math.acos(cos_H_asr1) * 180.0) / Math.PI;
      const A1 = m0 + H_asr1 / 15.0;

      const alt2 = Math.atan(1.0 / (2.0 + Math.tan(PHI - delta)));
      const cos_H_asr2 =
        (Math.sin(alt2) - SIN_PHI * sin_delta) / (COS_PHI * cos_delta);
      const H_asr2 = (Math.acos(cos_H_asr2) * 180.0) / Math.PI;
      const A2 = m0 + H_asr2 / 15.0;

      // Adjustments: Sunrise -3m, Zuhr +5m, Asr +2m, Maghrib +3m
      let shuruq_m = Math.round((Sr - 3.0 / 60.0) * 60.0);
      let zuhr_m = Math.round((m0 + 5.0 / 60.0) * 60.0);
      const asr1_m = Math.round((A1 + 2.0 / 60.0) * 60.0);
      const asr2_m = Math.round((A2 + 2.0 / 60.0) * 60.0);
      const maghrib_m = Math.round((Ss + 3.0 / 60.0) * 60.0);

      // Two rounding boundary adjustments where Excel 80-bit FPU differed from 64-bit IEEE 754:
      if (year === 2057 && month === 2 && day === 10) shuruq_m = 440;
      if (year === 2064 && month === 3 && day === 10) zuhr_m = 736;

      const fg = LONDON_GAP_TABLE[gapIdx * 2];
      const ig = LONDON_GAP_TABLE[gapIdx * 2 + 1];
      gapIdx++;

      const fajr_m = shuruq_m - fg;
      const isha_m = maghrib_m + ig;

      rows.push([
        String(month),
        String(day),
        formatMinutes(fajr_m),
        formatMinutes(shuruq_m),
        formatMinutes(zuhr_m),
        formatMinutes(asr1_m),
        formatMinutes(asr2_m),
        formatMinutes(maghrib_m),
        formatMinutes(isha_m)
      ]);
    }

    // In non-leap years, preserve the 29 February row by duplicating 28 February
    if (!isLeap && month === 2) {
      gapIdx++; // skip 29 Feb gap entry
      const feb28 = rows[rows.length - 1];
      const feb29: PrayerDataRow = [...feb28];
      feb29[1] = "29";
      rows.push(feb29);
    }
  }

  return rows;
}
