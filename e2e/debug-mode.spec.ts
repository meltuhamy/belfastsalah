import { test, expect, type Page } from "@playwright/test";
import { PRAYER_STRIP, completeSetup, openSettings, pinDate, todayTimes } from "./support/app";

// The Version row, the gesture on it that turns debug mode on - seven taps,
// then a press held for seven seconds - and what debug mode adds: the day
// card preview, which shows any place, theme and moment without touching
// the real settings.

const NOON_ISH = "2026-02-15T10:00:00Z";

const versionRow = (page: Page) => page.getByTestId("version-row");

/** The preview's day card: Ionic keeps the home page's behind it, in the DOM. */
const previewCard = (page: Page) =>
  page.locator(".PrayerDayCard:has(~ [data-testid=day-card-preview])");
const homeCard = (page: Page) =>
  page.locator(".PrayerDayCard:not(:has(~ [data-testid=day-card-preview]))");

/** Taps the Version row `taps` times, then holds it for `holdMs`. */
async function unlock(page: Page, taps: number, holdMs: number) {
  const row = versionRow(page);
  await row.scrollIntoViewIfNeeded();
  const box = (await row.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  for (let i = 0; i < taps; i++) {
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.mouse.up();
    await page.waitForTimeout(150);
  }
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await pinDate(page, NOON_ISH);
  await completeSetup(page);
  await openSettings(page);
});

test("shows the version and the commit it was built from", async ({ page }) => {
  // The web has no store version; the commit is baked in at build time.
  await expect(page.getByTestId("version")).toHaveText(/^Web · ([0-9a-f]{7}|unknown)$/);
});

test("turns debug mode on with seven taps and a seven-second hold", async ({ page }) => {
  test.slow();
  await expect(page.getByTestId("debug-section")).toHaveCount(0);
  await unlock(page, 7, 7400);
  await expect(page.getByTestId("debug-section")).toBeVisible();
  await expect(page.getByText("Debug mode is on")).toBeVisible();

  // It stays on, and turns off from its own row.
  await page.reload();
  await expect(page.getByTestId("debug-section")).toBeVisible();
  await page.getByTestId("debug-off").click();
  await expect(page.getByTestId("debug-section")).toHaveCount(0);
});

test("stays off for six taps, or a hold let go too soon", async ({ page }) => {
  test.slow();
  await unlock(page, 6, 7400);
  await expect(page.getByTestId("debug-section")).toHaveCount(0);
  await page.waitForTimeout(1600);
  await unlock(page, 7, 5000);
  await page.waitForTimeout(2500);
  await expect(page.getByTestId("debug-section")).toHaveCount(0);
});

test.describe("the day card preview", () => {
  test.beforeEach(async ({ page }) => {
    test.slow();
    await unlock(page, 7, 7400);
    await page.getByTestId("debug-day-card").click();
    await expect(page.getByTestId("day-card-preview")).toBeVisible();
  });

  test("shows another place and moment, and leaves the real ones alone", async ({ page }) => {
    await page.getByRole("button", { name: "Pause" }).click();
    await page.getByRole("button", { name: "Istanbul" }).click();
    // Istanbul's Maghrib on 15 February 2026 is 18:44; a minute before.
    await page.getByTestId("jump-Maghrib-−1 min").click();
    await expect(page.getByTestId("preview-time")).toHaveText("18:43:00");
    await expect(previewCard(page)).toContainText("Istanbul");
    await expect(previewCard(page)).toContainText("Maghrib in");

    // Home again, from what is stored: still London, at the real (pinned) time.
    await page.goto("/");
    await expect(page.locator(PRAYER_STRIP)).toBeVisible();
    await expect.poll(async () => (await todayTimes(page)).Duhr).toBe("12:20");
    await expect(homeCard(page)).not.toContainText("Istanbul");
  });

  test("opens onto a scenario from a link", async ({ page }) => {
    await page.goto("/settings/debug/day-card?location=istanbul&theme=sky&at=2026-11-27T15:28&speed=0");
    await expect(page.getByTestId("preview-time")).toHaveText("15:28:00");
    await expect(page.getByRole("button", { name: "Istanbul" })).toHaveAttribute("aria-pressed", "true");
    // The painted Sky theme, not Sky V2.
    await expect(page.getByTestId("sun")).toHaveCount(1);
  });
});
