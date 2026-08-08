import { test, expect } from "@playwright/test";
import {
  LOCATION_SELECT,
  chooseFromSelect,
  completeSetup,
  goHome,
  openSettings,
  openSetup,
  pinDate,
  todayTimes,
  toggle,
} from "./support/app";

// Settings live in Capacitor Preferences, which is localStorage on the web, and
// are written through a 500ms debounce. Everything here reloads the page: a
// setting that only updates React state looks identical until you come back.

// The reminder toggle only stays on if the permission request is granted.
test.use({ permissions: ["notifications"] });

const NOON_ISH = "2026-02-15T10:00:00Z";

/** Reloads after giving the debounced write time to land. */
async function reload(page: import("@playwright/test").Page) {
  await page.waitForTimeout(700);
  await page.reload();
}

const selectValue = (page: import("@playwright/test").Page, selector: string) =>
  page
    .locator(selector)
    .evaluate((el) => (el as unknown as { value: unknown }).value);

test.beforeEach(async ({ page }) => {
  await pinDate(page, NOON_ISH);
});

test("goes straight past setup once it has been completed", async ({
  page,
}) => {
  await completeSetup(page);
  await reload(page);

  await expect(page.locator(".DayPrayerTable")).toBeVisible();
  await expect(page.getByRole("button", { name: "Done" })).toHaveCount(0);
});

test("keeps showing setup until Done is pressed", async ({ page }) => {
  await openSetup(page);
  await chooseFromSelect(page, LOCATION_SELECT, "Belfast");
  await page.reload();

  // Nothing was committed, so it is a fresh setup screen back on the default.
  await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
  await expect.poll(() => selectValue(page, LOCATION_SELECT)).toBe("london");
});

test("remembers the location", async ({ page }) => {
  await completeSetup(page);
  await openSettings(page);
  await chooseFromSelect(page, LOCATION_SELECT, "Belfast");
  await reload(page);

  await expect.poll(() => selectValue(page, LOCATION_SELECT)).toBe("belfast");
  await goHome(page);
  await expect.poll(async () => (await todayTimes(page)).Fajr).toBe("06:01");
});

test("remembers the Asr method", async ({ page }) => {
  await completeSetup(page);
  await openSettings(page);
  await toggle(page, "Use Hanafi Asr");
  await reload(page);

  await goHome(page);
  await expect.poll(async () => (await todayTimes(page)).Asr).toBe("15:25");
});

test("remembers the theme", async ({ page }) => {
  await completeSetup(page);
  await openSettings(page);
  await chooseFromSelect(page, "[data-testid=theme-select]", "Dark");
  await reload(page);

  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.classList.contains("ion-palette-dark")
      )
    )
    .toBe(true);
});

test("remembers that reminders are on, and how early", async ({ page }) => {
  await completeSetup(page);
  await openSettings(page);
  await toggle(page, "Notify before prayer");
  await expect(page.locator(".settings-list__range-label")).toBeVisible();

  await reload(page);
  await expect(page.locator(".settings-list__range-label")).toHaveText(
    "Notify 5 minutes before prayer"
  );
});

test("says so when it saves", async ({ page }) => {
  await completeSetup(page);
  await openSettings(page);
  await chooseFromSelect(page, LOCATION_SELECT, "Belfast");

  await expect(page.getByText("Your settings have been saved")).toBeVisible();
});

test("carries every setup answer across at once", async ({ page }) => {
  // Setup holds everything locally until Done, so this is the one moment the
  // whole blob is written. Several answers at once, then check they all stuck.
  await openSetup(page);
  await chooseFromSelect(page, LOCATION_SELECT, "Belfast");
  await chooseFromSelect(page, "[data-testid=theme-select]", "Dark");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Done" })).toHaveCount(0);

  await reload(page);

  await expect(page.locator(".DayPrayerTable")).toBeVisible();
  await expect.poll(async () => (await todayTimes(page)).Fajr).toBe("06:01");
  await expect(
    page.evaluate(() =>
      document.documentElement.classList.contains("ion-palette-dark")
    )
  ).resolves.toBe(true);
});
