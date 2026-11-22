import { test, expect } from "@playwright/test";
import {
  PRAYER_STRIP,
  completeSetup,
  highlightedDays,
  highlightedPrayer,
  monthRows,
  pinDate,
  paintedHighlight,
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
  Fajr: "05:35",
  Shuruq: "07:12",
  Duhr: "12:20",
  Asr: "14:46",
  Maghrib: "17:19",
  Isha: "18:49",
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
  await expect(page.getByTestId("day-date")).toHaveText("Sun 15 Feb");
  // The strip is the day the reader is on, so nothing to flag.
  await expect(page.getByTestId("tomorrow-badge")).toHaveCount(0);
});

test("names the next prayer and counts down to it", async ({ page }) => {
  // 10:00, so Duhr at 12:20 is next and Shuruq at 07:12 has been and gone.
  await expect(page.getByText("Duhr in")).toBeVisible();
  await expect(page.getByTestId("countdown")).toHaveText("2h 20m");
  await expect(page.getByText("Shuruq was 2h 48m ago")).toBeVisible();
});

test("highlights the prayer it is counting down to", async ({ page }) => {
  expect(await highlightedPrayer(page)).toBe("Duhr");
  await expect.poll(() => paintedHighlight(page)).toBe("Duhr");
});

test("highlights the columns on either end inside the card", async ({
  page,
}) => {
  // The two cells closest to the card's rounded corners.
  // Walked forwards, because that is the only direction the app expects the
  // clock to move: it refetches when a prayer passes, not when one un-passes.
  await page.clock.setFixedTime(new Date("2026-02-15T18:00:00Z"));
  await expect.poll(() => highlightedPrayer(page)).toBe("Isha");
  await expect.poll(() => paintedHighlight(page)).toBe("Isha");

  await page.clock.setFixedTime(new Date("2026-02-16T03:00:00Z"));
  await expect.poll(() => highlightedPrayer(page)).toBe("Fajr");
  await expect.poll(() => paintedHighlight(page)).toBe("Fajr");
});

test("fills a dot on the timeline for each prayer that has passed", async ({
  page,
}) => {
  const dots = page.locator("[data-testid=timeline] .PrayerDayCard__dot");
  // 10:00: Fajr and Shuruq are behind us, Duhr at 12:20 is not.
  await expect(dots).toHaveCount(6);
  await expect
    .poll(() => dots.evaluateAll((all) => all.map((d) => d.dataset.passed)))
    .toEqual(["true", "true", "false", "false", "false", "false"]);

  // Fajr and Shuruq, done, and Duhr, next, are at full strength; only the
  // prayers after the next one are faded back.
  await expect
    .poll(() =>
      dots.evaluateAll((all) => all.map((d) => getComputedStyle(d).opacity))
    )
    .toEqual(["1", "1", "1", "0.55", "0.55", "0.55"]);

  // After Isha the strip is tomorrow's, none of which has happened yet.
  await page.clock.setFixedTime(new Date("2026-02-15T20:00:00Z"));
  await expect
    .poll(() => dots.evaluateAll((all) => all.map((d) => d.dataset.passed)))
    .toEqual(["false", "false", "false", "false", "false", "false"]);
  await expect(page.locator(".PrayerDayCard__timeline-fill")).toHaveCount(0);
});

test("pulses a prayer's dot for its first ten minutes", async ({ page }) => {
  const recent = () =>
    page
      .locator("[data-testid=timeline] .PrayerDayCard__dot")
      .evaluateAll((all) => all.map((d) => d.dataset.recent));

  // Duhr came in at 12:20.
  await page.clock.setFixedTime(new Date("2026-02-15T12:25:00Z"));
  await expect
    .poll(recent)
    .toEqual(["false", "false", "true", "false", "false", "false"]);

  await page.clock.setFixedTime(new Date("2026-02-15T12:31:00Z"));
  await expect
    .poll(recent)
    .toEqual(["false", "false", "false", "false", "false", "false"]);
});

test("rolls the countdown onto the next prayer once one passes", async ({
  page,
}) => {
  await expect(page.getByText("Duhr in")).toBeVisible();

  // Straight past Duhr. The card should move on rather than count backwards.
  await page.clock.setFixedTime(new Date("2026-02-15T12:30:00Z"));
  await expect(page.getByText("Asr in")).toBeVisible();
  await expect(page.getByText("Duhr was 10m ago")).toBeVisible();
  await expect.poll(() => highlightedPrayer(page)).toBe("Asr");
  await expect.poll(() => paintedHighlight(page)).toBe("Asr");
});

test("moves the strip onto tomorrow once the last prayer has passed", async ({
  page,
}) => {
  // Isha is at 18:48 on the 15th, so at 20:00 there is nothing left today.
  await page.clock.setFixedTime(new Date("2026-02-15T20:00:00Z"));

  await expect(page.getByTestId("tomorrow-badge")).toHaveText("Tomorrow");
  await expect(page.getByTestId("day-date")).toHaveText("Mon 16 Feb");
  // 16 Feb's own Fajr, not the 15th's.
  await expect.poll(async () => (await todayTimes(page)).Fajr).toBe("05:33");
  await expect.poll(() => highlightedPrayer(page)).toBe("Fajr");
  await expect.poll(() => paintedHighlight(page)).toBe("Fajr");
});

test("carries the day over at midnight", async ({ page }) => {
  await expect(page.getByTestId("day-date")).toHaveText("Sun 15 Feb");

  await page.clock.setFixedTime(new Date("2026-02-16T00:30:00Z"));
  await expect(page.getByTestId("day-date")).toHaveText("Mon 16 Feb");
  // Past midnight the reader is on that day themselves, so the badge goes.
  await expect(page.getByTestId("tomorrow-badge")).toHaveCount(0);
  await expect.poll(async () => (await todayTimes(page)).Fajr).toBe("05:33");
});

test("keeps the toolbar flat until something is under it", async ({ page }) => {
  const shadow = () =>
    page.locator("ion-header").evaluate((h) => getComputedStyle(h).boxShadow);

  // The shadow is there to separate the toolbar from content passing beneath
  // it, so at rest it has nothing to separate.
  expect(await shadow()).toBe("none");

  await page.mouse.wheel(0, 400);
  await expect.poll(shadow).not.toBe("none");

  await page.mouse.wheel(0, -800);
  await expect.poll(shadow).toBe("none");
});

test("opens the month table on the current month", async ({ page }) => {
  await expect(page.getByText("February", { exact: true })).toBeVisible();
  await waitForMonthTable(page);

  const rows = await monthRows(page);
  // February 2026 has 28 days. The timetable file carries a 29th - every
  // non-leap year in src/prayer_data does, duplicating the 28th - so this is
  // also a check that the table follows the calendar and not the file.
  expect(rows).toHaveLength(28);
  expect(rows[0]).toEqual([
    "1",
    "05:59",
    "07:36",
    "12:19",
    "14:26",
    "16:53",
    "18:29",
  ]);
  expect(rows[27]).toEqual([
    "28",
    "05:08",
    "06:45",
    "12:18",
    "15:03",
    "17:42",
    "19:09",
  ]);
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
  await expect(
    page.locator("ion-title", { hasText: "Settings" })
  ).toBeVisible();
  await page.locator("ion-button[router-link='/']").click();
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();
});

// Icon-only, so without a label a screen reader announces nothing useful.
// Links rather than buttons: an ion-button with a routerLink renders an <a>. The
// iOS preview capture also finds them by these names.
test("names the settings and home links", async ({ page }) => {
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();
});
