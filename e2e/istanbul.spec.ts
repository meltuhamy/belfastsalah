import { test, expect, type Page } from "@playwright/test";
import {
  LOCATION_SELECT,
  chooseFromSelect,
  completeSetup,
  goHome,
  monthRows,
  openMonth,
  openSettings,
  pinDate,
  todayTimes,
  toggle,
} from "./support/app";

// Istanbul is calculated with Diyanet's method, and shown on Istanbul's own
// clock (UTC+3 all year) unless the person asks for their phone's. The
// numbers are Diyanet's own table for 15 February 2026
// (scripts/timetables/data/diyanet-istanbul-2026.json).

// 13:00 in Istanbul, 10:00 in London.
const NOON_ISH = "2026-02-15T10:00:00Z";

const ISTANBUL = {
  Fajr: "06:27",
  Shuruq: "07:52",
  Duhr: "13:23",
  Asr: "16:16",
  Maghrib: "18:44",
  Isha: "20:05",
};

// The same moments on a London clock, three hours behind in February.
const ISTANBUL_ON_LONDON_CLOCK = {
  Fajr: "03:27",
  Shuruq: "04:52",
  Duhr: "10:23",
  Asr: "13:16",
  Maghrib: "15:44",
  Isha: "17:05",
};

async function chooseIstanbul(page: Page) {
  await completeSetup(page);
  await openSettings(page);
  await chooseFromSelect(page, LOCATION_SELECT, "Istanbul");
}

test.beforeEach(async ({ page }) => {
  await pinDate(page, NOON_ISH);
});

test.describe("on a phone set to UK time", () => {
  test("shows Diyanet's times on Istanbul's clock", async ({ page }) => {
    await chooseIstanbul(page);
    await goHome(page);

    await expect.poll(() => todayTimes(page)).toEqual(ISTANBUL);

    await openMonth(page);
    const [, ...row] = (await monthRows(page))[14];
    expect(row).toEqual(Object.values(ISTANBUL));
  });

  test("can show the same times on the phone's own clock", async ({ page }) => {
    await chooseIstanbul(page);
    await goHome(page);

    // A UK phone disagrees with Istanbul's clock, so the app asks once.
    await page.locator("[data-testid=time-zone-notice-use-device]").click();
    await expect
      .poll(() => todayTimes(page))
      .toEqual(ISTANBUL_ON_LONDON_CLOCK);
  });
});

test.describe("on a phone set to Istanbul time", () => {
  test.use({ timezoneId: "Europe/Istanbul" });

  test("shows Diyanet's times without asking about the clock", async ({
    page,
  }) => {
    await chooseIstanbul(page);
    await goHome(page);

    await expect.poll(() => todayTimes(page)).toEqual(ISTANBUL);
    await expect(page.locator("[data-testid=time-zone-notice]")).toHaveCount(0);
  });
});

test("shows Diyanet's Asr, with no asr switch, for someone who chose Hanafi", async ({
  page,
}) => {
  await completeSetup(page);
  await openSettings(page);
  await toggle(page, "Use Hanafi Asr");
  await chooseFromSelect(page, LOCATION_SELECT, "Istanbul");

  // Diyanet publishes one Asr, so there is no switch, as for Belfast.
  await expect(page.getByText("Use Hanafi Asr")).toHaveCount(0);

  await goHome(page);
  await expect.poll(() => todayTimes(page)).toEqual(ISTANBUL);
});
