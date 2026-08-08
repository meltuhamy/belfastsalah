import { test, expect } from "@playwright/test";
import {
  completeSetup,
  highlightedDays,
  monthRows,
  pinDate,
  waitForMonthTable,
} from "./support/app";

// The month table and its picker. Day counts come from the calendar rather
// than from the data file, which matters: every non-leap year in
// src/prayer_data carries a 29 February row duplicating the 28th.

const NOON_ISH = "2026-02-15T10:00:00Z";

/** Opens the picker on the month card and chooses a month. */
async function chooseMonth(page: import("@playwright/test").Page, month: string) {
  await page.locator(".HomePage__month-card ion-icon").first().click();
  const picker = page.locator("ion-picker-legacy, ion-picker");
  await expect(picker.first()).toBeVisible();
  await page.getByRole("button", { name: month, exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(picker.first()).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await pinDate(page, NOON_ISH);
  await completeSetup(page);
  await waitForMonthTable(page);
});

test("gives every month the number of days the calendar does", async ({
  page,
}) => {
  // February 2026 is 28 days: 2026 is not a leap year, whatever the timetable
  // file happens to contain.
  expect(await monthRows(page)).toHaveLength(28);

  await chooseMonth(page, "March");
  await expect.poll(async () => (await monthRows(page)).length).toBe(31);

  await chooseMonth(page, "April");
  await expect.poll(async () => (await monthRows(page)).length).toBe(30);
});

test("shows the chosen month's own times", async ({ page }) => {
  await chooseMonth(page, "March");
  await expect(page.getByText("March", { exact: true })).toBeVisible();
  await waitForMonthTable(page);

  // london-2026.json, 1 March.
  expect((await monthRows(page))[0]).toEqual([
    "1",
    "05:07",
    "06:44",
    "12:18",
    "15:04",
    "17:43",
    "19:09",
  ]);
});

test("highlights today only while the current month is showing", async ({
  page,
}) => {
  expect(await highlightedDays(page)).toEqual(["15"]);

  await chooseMonth(page, "March");
  await waitForMonthTable(page);
  await expect.poll(() => highlightedDays(page)).toEqual([]);
});

test("offers a way back to the current month, and only when away", async ({
  page,
}) => {
  const monthCardIcons = page.locator(".HomePage__month-card ion-icon");
  // Just the calendar icon while the current month is showing.
  await expect(monthCardIcons).toHaveCount(1);

  await chooseMonth(page, "March");
  await expect(monthCardIcons).toHaveCount(2);

  await monthCardIcons.nth(1).click();
  await expect(page.getByText("February", { exact: true })).toBeVisible();
  await expect(monthCardIcons).toHaveCount(1);
  await waitForMonthTable(page);
  await expect.poll(() => highlightedDays(page)).toEqual(["15"]);
});

test("keeps the header row above the times while scrolling", async ({
  page,
}) => {
  // The header sticks over its own rows, so it has to be opaque - a
  // transparent one lets the times show through it. Regressed once already
  // when the dark palette changed underneath it.
  const background = await page
    .locator(".MonthPrayerTable thead th")
    .nth(1)
    .evaluate((th) => getComputedStyle(th).backgroundColor);

  expect(background).not.toBe("rgba(0, 0, 0, 0)");
  expect(background).not.toBe("transparent");
});
