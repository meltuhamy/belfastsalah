import { test, expect } from "@playwright/test";
import {
  completeSetup,
  highlightedDays,
  monthRows,
  pinDate,
  todayTimes,
  waitForMonthTable,
} from "./support/app";

// The home screen is the app. Everything here is asserted against the real
// timetable in src/prayer_data rather than against whatever the app happens to
// render, so a change to the lookup shows up as a wrong number.
//
// 15 February 2026 is deliberately in winter: the UK is on GMT, so the times
// on screen are the timetable's own strings and the expectations below can be
// read straight out of london-2026.json.

const NOON_ISH = "2026-02-15T10:00:00Z";

const LONDON_15_FEB = {
  Fajr: "05:36",
  Shuruq: "07:13",
  Duhr: "12:20",
  Asr: "14:45",
  Maghrib: "17:18",
  Isha: "18:48",
};

test.beforeEach(async ({ page }) => {
  await pinDate(page, NOON_ISH);
  await completeSetup(page);
});

test("lists today's six prayers, as printed on the timetable", async ({
  page,
}) => {
  expect(await todayTimes(page)).toEqual(LONDON_15_FEB);
});

test("dates the card in the timetable's calendar", async ({ page }) => {
  await expect(page.getByText("Today: Sun 15 Feb")).toBeVisible();
});

test("names the next prayer and counts down to it", async ({ page }) => {
  // 10:00, so Duhr at 12:20 is next and Shuruq at 07:13 has been and gone.
  await expect(page.getByText("Next: Duhr")).toBeVisible();
  await expect(page.getByText("Duhr is in 2 hours 20 minutes")).toBeVisible();
  await expect(
    page.getByText("Shuruq was 2 hours 47 minutes ago")
  ).toBeVisible();
});

test("rolls the countdown onto the next prayer once one passes", async ({
  page,
}) => {
  await expect(page.getByText("Next: Duhr")).toBeVisible();

  // Straight past Duhr. The card should move on rather than count backwards.
  await page.clock.setFixedTime(new Date("2026-02-15T12:30:00Z"));
  await expect(page.getByText("Next: Asr")).toBeVisible();
  await expect(page.getByText("Duhr was 10 minutes ago")).toBeVisible();
});

test("carries the day over at midnight", async ({ page }) => {
  await expect(page.getByText("Today: Sun 15 Feb")).toBeVisible();

  await page.clock.setFixedTime(new Date("2026-02-16T00:30:00Z"));
  await expect(page.getByText("Today: Mon 16 Feb")).toBeVisible();
  // 16 Feb's own Fajr, not the 15th's.
  await expect.poll(async () => (await todayTimes(page)).Fajr).toBe("05:34");
});

test("opens the month table on the current month", async ({ page }) => {
  await expect(page.getByText("February", { exact: true })).toBeVisible();
  await waitForMonthTable(page);

  const rows = await monthRows(page);
  // February 2026 has 28 days. The timetable file carries a 29th - every
  // non-leap year in src/prayer_data does, duplicating the 28th - so this is
  // also a check that the table follows the calendar and not the file.
  expect(rows).toHaveLength(28);
  expect(rows[0]).toEqual(["1", "06:00", "07:37", "12:19", "14:25", "16:52", "18:28"]);
  expect(rows[27]).toEqual(["28", "05:09", "06:46", "12:18", "15:03", "17:41", "19:08"]);
});

test("marks today in the month table, and only today", async ({ page }) => {
  await waitForMonthTable(page);
  expect(await highlightedDays(page)).toEqual(["15"]);
});

test("agrees with the today card row for row", async ({ page }) => {
  await waitForMonthTable(page);
  const [, ...todayRow] = (await monthRows(page))[14];
  expect(todayRow).toEqual(Object.values(LONDON_15_FEB));
});

test("puts the settings screen one tap away and comes back", async ({
  page,
}) => {
  await page.locator("ion-button[router-link='/settings']").click();
  await expect(page.locator("ion-title", { hasText: "Settings" })).toBeVisible();
  await page.locator("ion-button[router-link='/']").click();
  await expect(page.locator(".DayPrayerTable")).toBeVisible();
});
