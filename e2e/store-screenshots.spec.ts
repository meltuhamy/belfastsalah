import { test, expect, type Page } from "@playwright/test";
import {
  chooseFromSelect,
  completeSetup,
  openSettings,
  openSetup,
  pinDate,
  toggle,
  waitForMonthTable,
} from "./support/app";

/**
 * Generates the phone screenshots for the Play listing.
 *
 *   npm run screenshots
 *
 * Skipped in ordinary runs - it produces files rather than asserting things,
 * and a listing image is not something to regenerate on every commit.
 *
 * Play wants 320-3840px on each side and a 16:9 or 9:16 ratio; these come out
 * at 1080x1920, which is 9:16 and matches what most phones report.
 */

const OUT = "store/screenshots";

// A winter date so the times on screen are the timetable's own strings, and
// mid-morning so the countdown reads sensibly rather than "in 12 seconds".
const WHEN = "2026-02-15T10:00:00Z";

test.use({
  viewport: { width: 360, height: 640 },
  deviceScaleFactor: 3,
  colorScheme: "light",
  // The reminder toggle only stays on if the permission request is granted.
  permissions: ["notifications"],
});

test.skip(
  !process.env.STORE_SCREENSHOTS,
  "Run with npm run screenshots to regenerate listing images."
);

/**
 * Waits out the "settings saved" toast, which covers the bottom of the screen
 * for a second. Both IonToasts are always in the DOM, so this counts the
 * visible ones rather than all of them.
 */
async function settle(page: Page) {
  // Settings are written through a 500ms debounce, and the toast follows that.
  // Polling straight away finds nothing, returns immediately, and the toast
  // then slides in over the screenshot - which is how it ended up in the
  // listing images once already.
  await page.waitForTimeout(700);
  await expect
    .poll(() => page.locator("ion-toast").filter({ visible: true }).count(), {
      timeout: 5000,
    })
    .toBe(0);
  await page.waitForTimeout(300);
}

test("home screen", async ({ page }) => {
  await pinDate(page, WHEN);
  await completeSetup(page);
  await waitForMonthTable(page);
  await settle(page);
  await page.screenshot({ path: `${OUT}/1-today.png` });
});

test("month table", async ({ page }) => {
  await pinDate(page, WHEN);
  await completeSetup(page);
  await waitForMonthTable(page);
  await settle(page);
  // Scroll the month card up so the table fills the frame.
  await page.locator(".HomePage__month-card").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/2-month.png` });
});

test("dark mode", async ({ page }) => {
  await pinDate(page, WHEN);
  await completeSetup(page);
  await openSettings(page);
  await chooseFromSelect(page, "[data-testid=theme-select]", "Dark");
  await page.locator("ion-button[router-link='/']").click();
  await waitForMonthTable(page);
  await settle(page);
  await page.screenshot({ path: `${OUT}/3-dark.png` });
});

test("reminders", async ({ page }) => {
  await pinDate(page, WHEN);
  await completeSetup(page);
  await openSettings(page);
  await toggle(page, "Notify before prayer");
  await expect(page.locator(".settings-list__range-label")).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${OUT}/4-reminders.png` });
});

test("setup", async ({ page }) => {
  await pinDate(page, WHEN);
  await openSetup(page);
  await settle(page);
  await page.screenshot({ path: `${OUT}/5-setup.png` });
});
