import { test, expect } from "@playwright/test";
import {
  completeSetup,
  monthRows,
  pinDate,
  todayTimes,
  waitForMonthTable,
} from "./support/app";

// The spreadsheet behind london-2026.json changes its clocks on 1 April and
// 28 October rather than on the real dates, and converting it with the real
// date once left the days in between an hour out: Fajr at 06:03 on
// 25 October instead of 05:03. On screen the times should carry on from one
// day to the next, with the hour moving on the real change - 29 March and
// 25 October 2026.

async function fajr(page: import("@playwright/test").Page, days: Array<number>) {
  const rows = await monthRows(page);
  return days.map((day) => rows[day - 1][1]);
}

test("springs forward on the last Sunday of March", async ({ page }) => {
  await pinDate(page, "2026-03-30T10:00:00Z");
  await completeSetup(page);
  await waitForMonthTable(page);

  await expect
    .poll(() => fajr(page, [28, 29, 30, 31]))
    .toEqual(["04:10", "05:08", "05:06", "05:05"]);
  expect((await todayTimes(page)).Fajr).toBe("05:06");
});

test("falls back on the last Sunday of October", async ({ page }) => {
  await pinDate(page, "2026-10-26T10:00:00Z");
  await completeSetup(page);
  await waitForMonthTable(page);

  await expect
    .poll(() => fajr(page, [24, 25, 26, 27, 28]))
    .toEqual(["06:01", "05:03", "05:04", "05:05", "05:07"]);
  expect((await todayTimes(page)).Fajr).toBe("05:04");
});
