import { test, expect, type Page } from "@playwright/test";
import {
  completeSetup,
  nextDaysRows,
  pinDate,
  waitForNextDays,
} from "./support/app";

// The Next 7 days card at the turn of a month and of a year (MEL-363). Today
// is always its first row: on the 31st the table used to open scrolled to the
// top of the month, with today 30 rows down.

async function todayRow(page: Page) {
  const today = page.locator("[data-testid=next-day][data-today=true]");
  await expect(today).toHaveCount(1);
  return today;
}

test.describe("on 31 December", () => {
  test.beforeEach(async ({ page }) => {
    await pinDate(page, "2026-12-31T12:00:00Z");
    await completeSetup(page);
    await waitForNextDays(page);
  });

  test("starts at today, and names the new year", async ({ page }) => {
    const rows = await nextDaysRows(page);
    expect(rows.map(([day]) => day)).toEqual([
      "31",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    // london-2026.json, 31 December.
    expect(rows[0]).toEqual([
      "31",
      "06:26",
      "08:03",
      "12:09",
      "13:45",
      "16:04",
      "17:41",
    ]);
    await expect(page.getByTestId("next-days-divider")).toHaveText([
      "January 2027",
    ]);
    await expect(page.getByTestId("next-days")).toContainText(
      "Thu 31 Dec – Wed 6 Jan"
    );
  });

  test("shows today's row without scrolling", async ({ page }) => {
    const today = await todayRow(page);
    await expect(today).toHaveAttribute("data-day", "31");
    const box = (await today.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });
});

test("names a new month without its year", async ({ page }) => {
  await pinDate(page, "2026-11-27T12:00:00Z");
  await completeSetup(page);
  await waitForNextDays(page);
  await expect(page.getByTestId("next-days-divider")).toHaveText(["December"]);
  expect((await nextDaysRows(page)).map(([day]) => day)).toEqual([
    "27",
    "28",
    "29",
    "30",
    "1",
    "2",
    "3",
  ]);
});

test("shows today's row without scrolling on the smallest phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await pinDate(page, "2026-12-31T12:00:00Z");
  await completeSetup(page);
  await waitForNextDays(page);
  const today = await todayRow(page);
  const box = (await today.boundingBox())!;
  // Its heading and first row of times, at least, above the fold.
  expect(box.y + 60).toBeLessThanOrEqual(568);
});
