import type { PrayerDataRow } from "./PrayerTimeData";

// Every timetable we ship, read as the raw rows.
const files = import.meta.glob<{ default: Array<PrayerDataRow> }>(
  "../prayer_data/*.json",
  { eager: true }
);

const prayerColumns = ["Fajr", "Shuruq", "Duhr", "Asr", "Asr (Hanafi)", "Maghrib", "Isha"];

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

describe("Prayer data files", () => {
  it("Should find the timetables", () => {
    expect(Object.keys(files).length).toBeGreaterThan(0);
  });

  // The files are in UTC, so nothing in them should move by more than a few
  // minutes from one day to the next. A jump of an hour is a row converted
  // with the wrong clock: a spreadsheet can change its clocks on dates of
  // its own, and days in 2025 and 2026 were an hour out until
  // scripts/spreadsheet-to-utc-json.js read the offset off the sheet. A
  // single wrong digit, like Belfast's Fajr on 8 October, shows up the same way.
  it.each(Object.keys(files))("Should have no jumps between days in %s", file => {
    const rows = files[file].default;
    const jumps: Array<string> = [];

    for (let i = 1; i < rows.length; i++) {
      const [month, day] = rows[i];
      prayerColumns.forEach((name, index) => {
        const before = rows[i - 1][index + 2];
        const after = rows[i][index + 2];
        if (before == null || after == null) return;
        const change = toMinutes(after) - toMinutes(before);
        if (Math.abs(change) > 30) {
          jumps.push(`${day}/${month} ${name}: ${before} -> ${after}`);
        }
      });
    }

    expect(jumps).toEqual([]);
  });
});
