import { test, expect, type Page } from "@playwright/test";
import {
  chooseFromSelect,
  completeSetup,
  openSettings,
  pinDate,
  toggle,
} from "./support/app";

// The reminder sound and Fajr's own sound. Tapping through Ionic's alert and
// what reaches the network when an adhan is chosen are real-browser concerns,
// hence e2e.

// The reminder toggle only stays on if the permission request is granted.
test.use({ permissions: ["notifications"] });

const SOUND = "[data-testid=notify-sound-select]";
const FAJR_SOUND = "[data-testid=fajr-sound-select]";

const selectValue = (page: Page, selector: string) =>
  page
    .locator(selector)
    .evaluate((el) => (el as unknown as { value: unknown }).value);

/** The option labels an Ionic select offers, read from its open alert. */
async function optionsOf(page: Page, selector: string): Promise<string[]> {
  const row = page.locator("ion-item").filter({ has: page.locator(selector) });
  const box = (await row.boundingBox())!;
  await row.tap({ position: { x: box.width - 20, y: box.height / 2 } });
  const alert = page.locator("ion-alert");
  await expect(alert).toBeVisible();
  const labels = await alert.getByRole("radio").allInnerTexts();
  await alert.getByRole("button", { name: "Cancel" }).click();
  await expect(alert).toBeHidden();
  return labels.map((label) => label.trim());
}

async function settingsWithReminders(page: Page) {
  await completeSetup(page);
  await openSettings(page);
  await toggle(page, "Notify before prayer");
  await expect(page.locator(SOUND)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await pinDate(page, "2026-01-15T10:00:00Z");
});

test("offers no sound choice while reminders are off", async ({ page }) => {
  await completeSetup(page);
  await openSettings(page);
  await expect(page.locator(SOUND)).toHaveCount(0);
  await expect(page.locator(FAJR_SOUND)).toHaveCount(0);
});

test("starts on the phone's default sound, with Fajr following it", async ({
  page,
}) => {
  await settingsWithReminders(page);
  expect(await selectValue(page, SOUND)).toBe("default");
  expect(await selectValue(page, FAJR_SOUND)).toBe("same");
});

test("lists the adhans by number only", async ({ page }) => {
  await settingsWithReminders(page);

  expect(await optionsOf(page, SOUND)).toEqual([
    "Default sound",
    "Silent",
    "Adhan 1",
    "Adhan 2",
    "Adhan 3",
    "Adhan 4",
    "Adhan 5",
  ]);
  expect(await optionsOf(page, FAJR_SOUND)).toEqual([
    "Same as other prayers",
    "Default sound",
    "Silent",
    "Adhan 1",
    "Adhan 2",
    "Adhan 3",
    "Adhan 4",
    "Adhan 5",
  ]);
});

test("plays an adhan when it is chosen", async ({ page }) => {
  await settingsWithReminders(page);

  const preview = page.waitForRequest(/\/sounds\/adhan-3\.mp3$/);
  await chooseFromSelect(page, SOUND, "Adhan 3");
  await preview;

  const fajrPreview = page.waitForRequest(/\/sounds\/adhan-5\.mp3$/);
  await chooseFromSelect(page, FAJR_SOUND, "Adhan 5");
  await fajrPreview;
});

test("remembers both sounds", async ({ page }) => {
  await settingsWithReminders(page);
  await chooseFromSelect(page, SOUND, "Adhan 2");
  await chooseFromSelect(page, FAJR_SOUND, "Silent");

  // Settings are written through a 500ms debounce.
  await page.waitForTimeout(700);
  await page.reload();
  // The reload lands back on the settings screen.
  await expect(page.locator(SOUND)).toBeVisible();

  await expect.poll(() => selectValue(page, SOUND)).toBe("adhan-2");
  await expect.poll(() => selectValue(page, FAJR_SOUND)).toBe("silent");
});

test("serves every adhan's preview", async ({ page, baseURL }) => {
  for (let n = 1; n <= 5; n++) {
    const response = await page.request.get(`${baseURL}/sounds/adhan-${n}.mp3`);
    expect(response.status(), `adhan-${n}.mp3`).toBe(200);
    expect(response.headers()["content-type"]).toContain("audio");
  }
});
