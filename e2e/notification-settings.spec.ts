import { test, expect, type Page } from "@playwright/test";

// The reminder row carries a hidden diagnostic: long-pressing the timer icon
// schedules a notification a few seconds out, so the whole path can be checked
// without waiting for a prayer time. Press-and-hold timing and hit areas are
// real-browser concerns, hence e2e rather than jsdom.

test.use({ permissions: ["notifications"] });

async function enableReminders(page: Page) {
  await page.goto("/");
  await page.waitForSelector("[data-testid=location-select]");
  await page
    .locator("ion-toggle")
    .filter({ hasText: "Notify before prayer" })
    .click();
  await expect(page.locator(".settings-list__range-label")).toBeVisible();
}

// Matched by test id rather than message: whether the browser actually grants
// notification permission is not something a headless run can be relied on to
// do, and either outcome - scheduled, or blocked - means the long press fired.
// Asserting only the success message made this fail on CI while passing
// locally, which said nothing about the code.
const testToast = (page: Page) =>
  page.getByTestId("test-notification-toast");

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

test("renders the timer icon like every other row icon", async ({ page }) => {
  // The icon is wrapped so it can carry the long-press handlers, which takes
  // it out of Ionic's ion-icon[slot=start] rules. That has already cost the
  // size, the spacing and the colour once each, so this compares the effective
  // appearance of every row icon rather than any single property.
  await enableReminders(page);

  const swatches = [];
  for (const icon of await page.locator("ion-item ion-icon").all()) {
    const box = await icon.boundingBox();
    if (!box || box.x > 100) {
      continue;
    }
    swatches.push(
      await icon.evaluate((el) => {
        const style = getComputedStyle(el);
        const parts = style.color.match(/[\d.]+/g)!.map(Number);
        return {
          rgb: `${parts[0]},${parts[1]},${parts[2]}`,
          // colour alpha and element opacity are interchangeable visually
          alpha: Math.round((parts[3] ?? 1) * Number(style.opacity) * 100) / 100,
          size: style.fontSize,
        };
      })
    );
  }

  expect(swatches.length).toBeGreaterThan(1);
  for (const swatch of swatches) {
    expect(swatch).toEqual(swatches[0]);
  }
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
  await expect(testToast(page)).toHaveAttribute(
    "message",
    /Test notification in \d+ seconds|Notifications are blocked/
  );
});

test("does not fire on a short tap", async ({ page }) => {
  await enableReminders(page);

  await page.getByTestId("notify-test-target").click();
  await page.waitForTimeout(1200);

  await expect(testToast(page)).toBeHidden();
});
