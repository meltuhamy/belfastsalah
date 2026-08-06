import { test, expect, type Page } from "@playwright/test";

// The reminder row carries a hidden diagnostic: long-pressing the timer icon
// schedules a notification a few seconds out, so the whole path can be checked
// without waiting for a prayer time. Press-and-hold timing and hit areas are
// real-browser concerns, hence e2e rather than jsdom.

test.use({ permissions: ["notifications"] });

async function enableReminders(page: Page) {
  await page.goto("/");
  await page.waitForSelector("ion-select");
  await page
    .locator("ion-toggle")
    .filter({ hasText: "Notify before prayer" })
    .click();
  await expect(page.locator(".settings-list__range-label")).toBeVisible();
}

const testToast = (page: Page) =>
  page.locator('ion-toast[message*="Test notification"]');

test("reads the reminder offset in full-size text", async ({ page }) => {
  await enableReminders(page);
  await expect(page.locator(".settings-list__range-label")).toHaveText(
    "Notify 5 minutes before prayer"
  );
});

test("lines the reminder row up with the rest of the list", async ({
  page,
}) => {
  // The timer icon is wrapped so it can carry the long-press handlers, which
  // takes it out of Ionic's ion-icon[slot=start] rules. When that regressed it
  // rendered at 16px and dragged the label out of line with every other row.
  await enableReminders(page);

  const boxes = await Promise.all(
    (await page.locator("ion-item ion-icon").all()).map((i) => i.boundingBox())
  );
  const rowIcons = boxes.filter((b) => b !== null && b.x < 100);
  for (const box of rowIcons) {
    expect(box!.width).toBe(24);
    expect(box!.x).toBe(32);
  }

  const label = await page.locator(".settings-list__range-label").boundingBox();
  const toggle = await page
    .locator("ion-toggle")
    .filter({ hasText: "Notify before prayer" })
    .boundingBox();
  expect(label!.x).toBe(toggle!.x);
});

test("gives the hidden press target a usable hit area", async ({ page }) => {
  await enableReminders(page);
  const box = await page.getByTestId("notify-test-target").boundingBox();
  // 44px is the smallest comfortably tappable target; the icon itself is 24.
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("schedules a test notification on long press", async ({ page }) => {
  await enableReminders(page);

  const box = await page.getByTestId("notify-test-target").boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();

  await expect(testToast(page)).toBeVisible();
});

test("does not fire on a short tap", async ({ page }) => {
  await enableReminders(page);

  await page.getByTestId("notify-test-target").click();
  await page.waitForTimeout(1200);

  await expect(testToast(page)).toHaveCount(0);
});
