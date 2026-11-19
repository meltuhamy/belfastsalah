import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { calculateLondonPrayerTimes } from "./londonCalculation";
import type { PrayerDataRow } from "./PrayerTimeData";

// Expected SHA-256 hash across all 50 years (2027-2076) of compact JSON output:
// 128,100 prayer times (50 years * 366 days * 7 times).
const EXPECTED_50_YEAR_HASH =
  "86ba633a1e8c4724d638fe5be4fd9ab7b19fbaf85446ad821603e247d43fac1d";

describe("London prayer calculation", () => {
  it("reproduces 100% of London prayer times 2027-2076 exactly", () => {
    const PRAYER_NAMES = [
      "Fajr",
      "Shuruq",
      "Duhr",
      "Asr",
      "Asr (Hanafi)",
      "Maghrib",
      "Isha",
    ];
    let totalChecked = 0;
    let totalMismatches = 0;
    const mismatchesPerPrayer = [0, 0, 0, 0, 0, 0, 0];
    const exampleMismatches: Array<string> = [];

    const hasher = createHash("sha256");
    let comparedFilesCount = 0;

    for (let year = 2027; year <= 2076; year++) {
      const calculated = calculateLondonPrayerTimes(year);
      expect(calculated.length).toBe(366);

      hasher.update(JSON.stringify(calculated));

      // If the shipped JSON file exists (before deletion), compare directly
      const filePath = join(__dirname, "../prayer_data", `london-${year}.json`);
      if (existsSync(filePath)) {
        comparedFilesCount++;
        const fileContent = readFileSync(filePath, "utf8");
        const expectedRows: Array<PrayerDataRow> = JSON.parse(fileContent);
        expect(calculated.length).toBe(expectedRows.length);

        for (let r = 0; r < calculated.length; r++) {
          const calcRow = calculated[r];
          const expRow = expectedRows[r];

          expect(calcRow[0]).toBe(expRow[0]); // month
          expect(calcRow[1]).toBe(expRow[1]); // day

          for (let p = 0; p < 7; p++) {
            totalChecked++;
            const calcTime = calcRow[p + 2];
            const expTime = expRow[p + 2];
            if (calcTime !== expTime) {
              totalMismatches++;
              mismatchesPerPrayer[p]++;
              if (exampleMismatches.length < 5) {
                exampleMismatches.push(
                  `${year}-${calcRow[0]}-${calcRow[1]} ${PRAYER_NAMES[p]}: got ${calcTime}, expected ${expTime}`
                );
              }
            }
          }
        }
      }
    }

    // Verify 50-year dataset hash (permanent check in CI)
    const digest = hasher.digest("hex");
    expect(digest).toBe(EXPECTED_50_YEAR_HASH);

    if (comparedFilesCount > 0) {
      // Diagnostic output when files are present
      if (totalMismatches > 0) {
        const breakdown = PRAYER_NAMES.map(
          (name, i) => `${name}: ${mismatchesPerPrayer[i]}`
        ).join(", ");
        throw new Error(
          `Calculation mismatches: ${totalMismatches}/${totalChecked} (${breakdown})\nExamples:\n` +
            exampleMismatches.join("\n")
        );
      }
      expect(totalMismatches).toBe(0);
      expect(totalChecked).toBe(128_100);
    }
  });

  it("produces exact expected rows for landmark and edge-case dates", () => {
    // 2027-01-01 (start of calculated era)
    const rows2027 = calculateLondonPrayerTimes(2027);
    expect(rows2027[0]).toEqual([
      "1",
      "1",
      "06:26",
      "08:03",
      "12:09",
      "13:47",
      "14:17",
      "16:05",
      "17:42",
    ]);

    // 2027-02-29 (non-leap year duplicate of 28 Feb)
    const feb28_2027 = rows2027.find((r) => r[0] === "2" && r[1] === "28")!;
    const feb29_2027 = rows2027.find((r) => r[0] === "2" && r[1] === "29")!;
    expect(feb29_2027.slice(2)).toEqual(feb28_2027.slice(2));

    // 2028-02-29 (leap year leap day)
    const rows2028 = calculateLondonPrayerTimes(2028);
    const feb29_2028 = rows2028.find((r) => r[0] === "2" && r[1] === "29")!;
    expect(feb29_2028).toEqual([
      "2",
      "29",
      "05:06",
      "06:43",
      "12:18",
      "15:05",
      "15:49",
      "17:42",
      "19:08",
    ]);

    // 2057-02-10 (boundary rounding case: Shuruq is 07:20)
    const rows2057 = calculateLondonPrayerTimes(2057);
    const feb10_2057 = rows2057.find((r) => r[0] === "2" && r[1] === "10")!;
    expect(feb10_2057).toEqual([
      "2",
      "10",
      "05:43",
      "07:20",
      "12:20",
      "14:41",
      "15:19",
      "17:10",
      "18:41",
    ]);

    // 2064-03-10 (boundary rounding case: Zuhr is 12:16)
    const rows2064 = calculateLondonPrayerTimes(2064);
    const mar10_2064 = rows2064.find((r) => r[0] === "3" && r[1] === "10")!;
    expect(mar10_2064).toEqual([
      "3",
      "10",
      "04:44",
      "06:21",
      "12:16",
      "15:17",
      "16:04",
      "18:00",
      "19:22",
    ]);

    // 2076-12-31 (end of 2076 era)
    const rows2076 = calculateLondonPrayerTimes(2076);
    expect(rows2076[rows2076.length - 1]).toEqual([
      "12",
      "31",
      "06:26",
      "08:03",
      "12:09",
      "13:47",
      "14:17",
      "16:05",
      "17:42",
    ]);
  });

  it("calculates prayer times correctly for post-2076 years", () => {
    // 2099-03-04
    const rows2099 = calculateLondonPrayerTimes(2099);
    expect(rows2099.length).toBe(366);
    const mar4_2099 = rows2099.find((r) => r[0] === "3" && r[1] === "4")!;
    expect(mar4_2099[2]).toBe("04:58"); // Fajr
    expect(mar4_2099[3]).toBe("06:35"); // Shuruq
  });
});
