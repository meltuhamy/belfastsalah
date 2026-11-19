import { createHash } from "node:crypto";
import { calculateLondonYear, londonTimes } from "./londonCalculation";

// The London Unified Prayer Timetable's files for 2027 to 2076 are no longer
// shipped: the app calculates those years. This is what proves the
// calculation reproduces them, all seven times on every day of all fifty
// years. The files are gone, so it compares against a hash of them, taken at
// 03f7f53 (the last commit that had them) by hashing each file's rows as
// JSON.stringify writes them, one line per year:
//
//   for y in 2027..2076: sha256.update(JSON.stringify(JSON.parse(
//     `git show 03f7f53:src/prayer_data/london-${y}.json`)) + "\n")
//
// When this fails, scripts/timetables/compare-london.mjs says which days and
// times differ, reading the files back out of git.
const FILES_2027_TO_2076_SHA256 =
  "a18b19d86e2caa1cb10c1c9d68f08941dac0c9fcff3d789e05413d0a79c7915a";

describe("London calculation", () => {
  it("Should reproduce the timetable's files for 2027 to 2076 exactly", () => {
    const hash = createHash("sha256");
    for (let year = 2027; year <= 2076; year++) {
      hash.update(JSON.stringify(calculateLondonYear(year)) + "\n");
    }
    expect(hash.digest("hex")).toBe(FILES_2027_TO_2076_SHA256);
  });

  // A few rows as they were in the files, so a failure says something before
  // anyone reaches for the script.
  it.each([
    [2030, ["7", "8", "01:58", "03:51", "12:11", "16:28", "17:41", "20:21", "21:31"]],
    // The two days the calculation's rounding is overridden on.
    [2057, ["2", "10", "05:43", "07:20", "12:20", "14:41", "15:19", "17:10", "18:41"]],
    [2064, ["3", "10", "04:44", "06:21", "12:16", "15:17", "16:04", "18:00", "19:22"]]
  ])("Should match the %s file's row for %j", (year, row) => {
    const rows = calculateLondonYear(year);
    expect(rows.find(r => r[0] === row[0] && r[1] === row[1])).toEqual(row);
  });

  it("Should repeat 28 February as 29 February in a year that has none", () => {
    const rows = calculateLondonYear(2077);
    const [feb28, feb29] = rows.filter(r => r[0] === "2" && +r[1]! >= 28);
    expect(feb29).toEqual(["2", "29", ...feb28.slice(2)]);
    expect(rows).toHaveLength(366);
  });

  it("Should calculate a real 29 February in a leap year", () => {
    const rows = calculateLondonYear(2080);
    const [feb28, feb29] = rows.filter(r => r[0] === "2" && +r[1]! >= 28);
    expect(feb29.slice(2)).not.toEqual(feb28.slice(2));
  });

  // Past the files there is nothing to compare with, so check the times keep
  // the shape of a London day, change smoothly, and keep drifting with the
  // calendar rather than repeating a year.
  it("Should give sensible times for a century after the files", () => {
    const toMinutes = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3);
    const problems: Array<string> = [];
    for (let year = 2077; year <= 2176; year++) {
      const rows = calculateLondonYear(year);
      rows.forEach((row, i) => {
        const times = row.slice(2).map(t => toMinutes(t!));
        if (times.some((t, k) => k > 0 && t <= times[k - 1])) {
          problems.push(`${year}-${row[0]}-${row[1]} out of order: ${row.slice(2)}`);
        }
        const before = i > 0 ? rows[i - 1].slice(2).map(t => toMinutes(t!)) : times;
        if (times.some((t, k) => Math.abs(t - before[k]) > 5)) {
          problems.push(`${year}-${row[0]}-${row[1]} jumps from the day before`);
        }
      });
    }
    expect(problems).toEqual([]);
    expect(calculateLondonYear(2077)).not.toEqual(calculateLondonYear(2076));
  });

  it("Should only override roundings that really are on the half minute", () => {
    // 07:20 and 12:16 in the files. The calculation is within milliseconds of
    // both, so the overrides cannot be hiding a real error.
    expect(londonTimes(2057, 2, 10).sunrise % 1).toBeCloseTo(0.5, 3);
    expect(londonTimes(2064, 3, 10).zuhr % 1).toBeCloseTo(0.5, 3);
  });
});
