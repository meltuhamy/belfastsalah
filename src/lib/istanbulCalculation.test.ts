import { readFileSync } from "node:fs";
import { calculateIstanbulYear } from "./istanbulCalculation";
import { getPrayerData } from "./PrayerTimeData";
import {
  AsrMethod,
  IstanbulPrayerTimes,
  Prayer,
  PrayerLocation,
  createPrayerTimes
} from "./PrayerTimes";
import supportsHanafiAsr from "./PrayerTimes";

// Diyanet's own 2026 table for Istanbul (district 9541), as published on
// namazvakitleri.diyanet.gov.tr: [year, month, day, İmsak, Güneş, Öğle,
// İkindi, Akşam, Yatsı], in Istanbul's time, UTC+3 all year.
const published: Array<[number, number, number, ...Array<string>]> = JSON.parse(
  readFileSync("scripts/timetables/data/diyanet-istanbul-2026.json", "utf8")
);

const toUtc = (istanbul: string) => {
  const [h, m] = istanbul.split(":").map(Number);
  const minutes = h * 60 + m - 180;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

describe("Istanbul calculation", () => {
  it("Should give every time of Diyanet's 2026 table exactly", () => {
    expect(published).toHaveLength(365);
    const rows = calculateIstanbulYear(2026);
    const misses: Array<string> = [];
    for (const [, month, day, ...times] of published) {
      const row = rows.find(r => r[0] === String(month) && r[1] === String(day))!;
      // The rows are UTC, with the empty Hanafi column after Asr.
      const [fajr, sunrise, dhuhr, asr, asr2, maghrib, isha] = row.slice(2);
      expect(asr2).toBeNull();
      [fajr, sunrise, dhuhr, asr, maghrib, isha].forEach((time, i) => {
        if (time !== toUtc(times[i])) {
          misses.push(`${month}/${day} #${i}: ${time} want ${toUtc(times[i])}`);
        }
      });
    }
    expect(misses).toEqual([]);
  });

  it("Should calculate 2027 rather than show 2026 again", async () => {
    const times = new IstanbulPrayerTimes();
    const day2026 = await times.getDay(new Date(Date.UTC(2026, 0, 15, 9)));
    const day2027 = await times.getDay(new Date(Date.UTC(2027, 0, 15, 9)));
    expect(day2027[Prayer.Fajr].time.getUTCFullYear()).toBe(2027);
    // The same date a year on is not the same set of times.
    expect(
      day2027.map(p => p.time.getUTCHours() * 60 + p.time.getUTCMinutes())
    ).not.toEqual(day2026.map(p => p.time.getUTCHours() * 60 + p.time.getUTCMinutes()));
  });

  it("Should show Diyanet's Asr, not crash, when Hanafi Asr is chosen", async () => {
    expect(supportsHanafiAsr(PrayerLocation.Istanbul)).toBe(false);
    const hanafi = createPrayerTimes(PrayerLocation.Istanbul, AsrMethod.Hanafi);
    // 15 January 2026 in the table: İkindi 15:45 in Istanbul, 12:45 UTC.
    const day = await hanafi.getDay(new Date(Date.UTC(2026, 0, 15, 9)));
    expect(day[Prayer.Asr].time.toISOString()).toBe("2026-01-15T12:45:00.000Z");
    await expect(
      getPrayerData(PrayerLocation.Istanbul, AsrMethod.Shafi, 2026)
    ).resolves.toHaveLength(12);
  });

  it("Should read the day in Istanbul's calendar, whatever the device's", async () => {
    // 23:30 UTC on 14 January is already 15 January in Istanbul, whose
    // İmsak in the table is 06:50, 03:50 UTC.
    const day = await new IstanbulPrayerTimes().getDay(
      new Date(Date.UTC(2026, 0, 14, 23, 30))
    );
    expect(day[Prayer.Fajr].time.toISOString()).toBe("2026-01-15T03:50:00.000Z");
  });
});
