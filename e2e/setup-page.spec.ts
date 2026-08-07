import { test, expect, type Page } from "@playwright/test";

// The setup screen's location picker broke twice while it was a hand-rolled
// radio group separate from the settings screen's control:
//
//  1. It used React's onChange. Ionic emits ionChange, so the selection was
//     never stored and the controlled value snapped back.
//  2. It used Ionic's pre-8 syntax - an ion-radio beside a sibling ion-label
//     inside an ion-item - which Ionic 8 no longer associates, leaving only
//     the radio dot clickable.
//
// Setup now renders the same SettingsList the settings screen does, so there
// is one control to keep working. These run in a real browser because hit
// testing inside Ionic's shadow DOM is not something jsdom can answer.

const selectValue = (page: Page) =>
  page.$eval("[data-testid=location-select]", (s) => (s as unknown as { value: string }).value);

/** Taps the location row well away from the control, at its trailing edge. */
async function tapRowAwayFromControl(page: Page) {
  const row = page
    .locator("ion-item")
    .filter({ has: page.locator("[data-testid=location-select]") });
  const box = await row.boundingBox();
  if (!box) {
    throw new Error("Could not find the location row");
  }
  await page.touchscreen.tap(box.x + box.width - 20, box.y + box.height / 2);
}

/** Picks an option from the dialog IonSelect opens. */
async function chooseFromDialog(page: Page, label: string) {
  const alert = page.locator("ion-alert");
  await expect(alert).toBeVisible();
  await alert.getByRole("radio", { name: label }).click();
  await alert.getByRole("button", { name: "Choose" }).click();
  await expect(alert).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("[data-testid=location-select]");
});

test("is a single screen with no wizard step", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
});

test("shows location above notifications", async ({ page }) => {
  const locationRow = page
    .locator("ion-item")
    .filter({ has: page.locator("[data-testid=location-select]") });
  const notifyRow = page
    .locator("ion-item")
    .filter({ hasText: "Notify before prayer" });

  const locationBox = await locationRow.boundingBox();
  const notifyBox = await notifyRow.boundingBox();
  expect(locationBox!.y).toBeLessThan(notifyBox!.y);
});

test("shows every settings group, in order, without paging", async ({
  page,
}) => {
  await expect(page.locator("ion-list-header")).toHaveText([
    "Prayer time settings",
    "Notifications",
    "Appearance",
    "About",
  ]);
});

test("defaults to London", async ({ page }) => {
  expect(await selectValue(page)).toBe("london");
});

test("opens the picker when the row is tapped away from the control", async ({
  page,
}) => {
  await tapRowAwayFromControl(page);
  await expect(page.locator("ion-alert")).toBeVisible();
});

test("selects Belfast", async ({ page }) => {
  await tapRowAwayFromControl(page);
  await chooseFromDialog(page, "Belfast");
  await expect.poll(() => selectValue(page)).toBe("belfast");
});

test("can switch back to London", async ({ page }) => {
  await tapRowAwayFromControl(page);
  await chooseFromDialog(page, "Belfast");
  await expect.poll(() => selectValue(page)).toBe("belfast");

  await tapRowAwayFromControl(page);
  await chooseFromDialog(page, "London");
  await expect.poll(() => selectValue(page)).toBe("london");
});

test("keeps the choice across repeated changes", async ({ page }) => {
  // The screen re-renders every second off the app ticker, so a selection has
  // to survive taps landing anywhere in that cycle.
  for (const [label, want] of [
    ["Belfast", "belfast"],
    ["London", "london"],
    ["Belfast", "belfast"],
  ] as const) {
    await page.waitForTimeout(450);
    await tapRowAwayFromControl(page);
    await chooseFromDialog(page, label);
    await expect.poll(() => selectValue(page)).toBe(want);
  }
});

test("hides hanafi asr for locations that do not support it", async ({
  page,
}) => {
  // London publishes a second asr column, Belfast does not.
  await expect(page.getByText("Use Hanafi Asr")).toBeVisible();

  await tapRowAwayFromControl(page);
  await chooseFromDialog(page, "Belfast");
  await expect.poll(() => selectValue(page)).toBe("belfast");

  await expect(page.getByText("Use Hanafi Asr")).toHaveCount(0);
});

test("completing setup leaves the setup screen", async ({ page }) => {
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Done" })).toHaveCount(0);
});
