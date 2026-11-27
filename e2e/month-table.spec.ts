import { test, expect, type Page } from "@playwright/test";
import {
  PRAYER_STRIP,
  completeSetup,
  highlightedDays,
  monthRows,
  openMonth,
  pinDate,
  waitForMonthTable,
} from "./support/app";

// The whole month, on its own screen behind the Month button (MEL-363). Day
// counts come from the calendar rather than from the data file, which
// matters: every non-leap year in src/prayer_data carries a 29 February row
// duplicating the 28th.

const NOON_ISH = "2026-02-15T10:00:00Z";

/** Opens the month picker and chooses a month of the year on show. */
async function chooseMonth(page: Page, month: string) {
  await page.getByTestId("month-picker").click();
  const picker = page.locator("ion-picker-legacy, ion-picker");
  await expect(picker.first()).toBeVisible();
  await page.getByRole("button", { name: month, exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(picker.first()).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await pinDate(page, NOON_ISH);
  await completeSetup(page);
  await openMonth(page);
});

test("opens on the current month", async ({ page }) => {
  await expect(page.getByTestId("month-title")).toHaveText("February 2026");
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
  await expect(page.getByTestId("month-title")).toHaveText("March 2026");

  // london-2026.json, 1 March.
  await expect
    .poll(async () => (await monthRows(page))[0])
    .toEqual(["1", "05:06", "06:43", "12:18", "15:04", "17:44", "19:10"]);
});

test("names each day's weekday", async ({ page }) => {
  // 1 February 2026 was a Sunday.
  await expect(
    page.locator(".MonthPrayerTable tbody tr").first().locator("td").first()
  ).toHaveText("1Su");
});

test("highlights today only while the current month is showing", async ({
  page,
}) => {
  expect(await highlightedDays(page)).toEqual(["15"]);

  await chooseMonth(page, "March");
  await waitForMonthTable(page);
  await expect.poll(() => highlightedDays(page)).toEqual([]);
});

test("steps a month either way, across the turn of the year", async ({
  page,
}) => {
  const previous = page.getByTestId("previous-month");
  const next = page.getByTestId("next-month");
  await expect(previous).toHaveText("January");
  await expect(next).toHaveText("March");

  await previous.click();
  await expect(page.getByTestId("month-title")).toHaveText("January 2026");
  await previous.click();
  await expect(page.getByTestId("month-title")).toHaveText("December 2025");
  // london-2025.json, 1 December.
  await expect
    .poll(async () => (await monthRows(page))[0]?.[0])
    .toBe("1");
  await expect.poll(async () => (await monthRows(page)).length).toBe(31);
  await expect.poll(() => highlightedDays(page)).toEqual([]);

  await next.click();
  await next.click();
  await expect(page.getByTestId("month-title")).toHaveText("February 2026");
  await expect.poll(() => highlightedDays(page)).toEqual(["15"]);
});

test("does not mark the same day of another year as today", async ({
  page,
}) => {
  for (let i = 0; i < 12; i++) {
    await page.getByTestId("next-month").click();
  }
  await expect(page.getByTestId("month-title")).toHaveText("February 2027");
  await waitForMonthTable(page);
  await expect.poll(() => highlightedDays(page)).toEqual([]);
});

test("gives the picker and the arrows room to tap", async ({ page }) => {
  // 48 x 48 for the picker; at least 44 tall for the rest (MEL-363).
  // Polled: the page may still be sliding in.
  const size = async (id: string) => {
    const box = await page.getByTestId(id).boundingBox();
    return box == null ? [0, 0] : [box.width, box.height];
  };
  await expect.poll(() => size("month-picker")).toEqual([48, 48]);
  for (const id of ["previous-month", "next-month"]) {
    await expect
      .poll(async () => (await size(id))[1])
      .toBeGreaterThanOrEqual(44);
  }
});

test("goes back to the home screen", async ({ page }) => {
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();
  await expect(page.getByTestId("month-title")).toHaveCount(0);
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
