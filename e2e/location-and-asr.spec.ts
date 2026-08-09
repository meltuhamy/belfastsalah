import { test, expect } from "@playwright/test";
import {
  LOCATION_SELECT,
  chooseFromSelect,
  completeSetup,
  goHome,
  monthRows,
  openSettings,
  pinDate,
  todayTimes,
  toggle,
  waitForMonthTable,
} from "./support/app";

// The two settings that change which numbers the app shows. Both are asserted
// against the timetables in src/prayer_data, so "the setting did something"
// is not enough - it has to do the right thing.
//
// Pinned to a winter date, when the UK is on GMT and the times on screen are
// the timetable's own strings.

const NOON_ISH = "2026-02-15T10:00:00Z";

// london-2026.json, 15 February.
const LONDON = {
  Fajr: "05:36",
  Shuruq: "07:13",
  Duhr: "12:20",
  Asr: "14:45",
  Maghrib: "17:18",
  Isha: "18:48",
};
const LONDON_HANAFI_ASR = "15:25";

// belfast-2019.json, 15 February. Belfast has only the one year of data, so it
// is served whatever year is asked for - which is why these are Belfast's
// times shown against a 2026 date.
const BELFAST = {
  Fajr: "06:01",
  Shuruq: "07:43",
  Duhr: "12:39",
  Asr: "15:00",
  Maghrib: "17:33",
  Isha: "19:10",
};

test.beforeEach(async ({ page }) => {
  await pinDate(page, NOON_ISH);
});

test("shows London's timetable by default", async ({ page }) => {
  await completeSetup(page);
  expect(await todayTimes(page)).toEqual(LONDON);
});

test("switches the whole app to Belfast's timetable", async ({ page }) => {
  await completeSetup(page);
  await openSettings(page);
  await chooseFromSelect(page, LOCATION_SELECT, "Belfast");
  await goHome(page);

  await expect.poll(() => todayTimes(page)).toEqual(BELFAST);

  // The month table is a separate lookup, so it gets its own check.
  await waitForMonthTable(page);
  const [, ...belfastRow] = (await monthRows(page))[14];
  expect(belfastRow).toEqual(Object.values(BELFAST));
});

test("switches back to London", async ({ page }) => {
  await completeSetup(page);
  await openSettings(page);
  await chooseFromSelect(page, LOCATION_SELECT, "Belfast");
  await chooseFromSelect(page, LOCATION_SELECT, "London");
  await goHome(page);
  await expect.poll(() => todayTimes(page)).toEqual(LONDON);
});

test("moves Asr, and only Asr, for the Hanafi method", async ({ page }) => {
  await completeSetup(page);
  await openSettings(page);
  await toggle(page, "Use Hanafi Asr");
  await goHome(page);

  await expect
    .poll(() => todayTimes(page))
    .toEqual({ ...LONDON, Asr: LONDON_HANAFI_ASR });
});

test("carries the Hanafi choice into the month table", async ({ page }) => {
  await completeSetup(page);
  await openSettings(page);
  await toggle(page, "Use Hanafi Asr");
  await goHome(page);

  await waitForMonthTable(page);
  await expect.poll(async () => (await monthRows(page))[14][4]).toBe(
    LONDON_HANAFI_ASR
  );
});

test("hides the Hanafi option for Belfast, which has no second Asr", async ({
  page,
}) => {
  await completeSetup(page);
  await openSettings(page);
  await expect(page.getByText("Use Hanafi Asr")).toBeVisible();

  await chooseFromSelect(page, LOCATION_SELECT, "Belfast");
  await expect(page.getByText("Use Hanafi Asr")).toHaveCount(0);
});

test("does not strand Belfast on an Asr method it cannot serve", async ({
  page,
}) => {
  // Turning Hanafi on and then moving to Belfast used to be the way to ask
  // for a column that does not exist in that timetable, which throws.
  await completeSetup(page);
  await openSettings(page);
  await toggle(page, "Use Hanafi Asr");
  await chooseFromSelect(page, LOCATION_SELECT, "Belfast");
  await goHome(page);

  await expect.poll(() => todayTimes(page)).toEqual(BELFAST);
});
