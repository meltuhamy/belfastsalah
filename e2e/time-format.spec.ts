import { test, expect } from "@playwright/test";
import {
  chooseFromSelect,
  completeSetup,
  goHome,
  monthRows,
  nextDaysRows,
  openSettings,
  pinDate,
  todayTimes,
} from "./support/app";

// The 12-hour clock leaves out AM and PM everywhere on screen: the prayer's
// name already says which half of the day it is, and the suffix made every
// time half again as wide. Winter, so the times are london-2026.json's own.

const NOON_ISH = "2026-02-15T10:00:00Z";

test.beforeEach(async ({ page }) => {
  await pinDate(page, NOON_ISH);
  await completeSetup(page);
  await openSettings(page);
  await chooseFromSelect(page, "[data-testid=time-format-select]", "12-hour");
  await goHome(page);
});

test("writes the strip on a 12-hour clock without AM or PM", async ({
  page,
}) => {
  expect(await todayTimes(page)).toEqual({
    Fajr: "5:35",
    Shuruq: "7:12",
    Duhr: "12:20",
    Asr: "2:46",
    Maghrib: "5:19",
    Isha: "6:49",
  });
});

test("writes the next seven days on a 12-hour clock too", async ({ page }) => {
  await expect
    .poll(async () => (await nextDaysRows(page))[0]?.slice(1) ?? [])
    .toEqual(["5:35", "7:12", "12:20", "2:46", "5:19", "6:49"]);
  const all = (await nextDaysRows(page)).flat().join(" ");
  expect(all).not.toMatch(/AM|PM/);
});

test("writes the month table on a 12-hour clock without AM or PM", async ({
  page,
}) => {
  await page.getByTestId("month-button").click();
  await expect
    .poll(async () => (await monthRows(page))[14]?.slice(1) ?? [])
    .toEqual(["5:35", "7:12", "12:20", "2:46", "5:19", "6:49"]);
  const all = (await monthRows(page)).flat().join(" ");
  expect(all).not.toMatch(/AM|PM/);
});
