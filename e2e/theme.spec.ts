import { test, expect, type Page } from "@playwright/test";

// The theme is one setting with four values, replacing a pair of coupled
// booleans. What matters is that choosing one actually repaints the app, so
// these assert the palette class and the colour it produces rather than the
// value stored - a setting that saves correctly but never reaches the DOM
// would look identical to a unit test.

const paletteIsDark = (page: Page) =>
  page.evaluate(() =>
    document.documentElement.classList.contains("ion-palette-dark")
  );

const backgroundColour = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/**
 * Finishes setup and opens the settings screen. Needed for anything about
 * "Dark after Maghrib": setup has no location yet, so there are no prayer
 * times for that mode to follow.
 */
async function openSettings(page: Page) {
  await page.waitForSelector("[data-testid=theme-select]");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Done" })).toHaveCount(0);
  await page.locator("ion-button[router-link='/settings']").click();
  await expect(page.locator("[data-testid=theme-select]")).toBeVisible();
}

async function chooseTheme(page: Page, label: string) {
  const row = page
    .locator("ion-item")
    .filter({ has: page.locator("[data-testid=theme-select]") });
  const box = await row.boundingBox();
  await row.tap({ position: { x: box!.width - 20, y: box!.height / 2 } });

  const alert = page.locator("ion-alert");
  await expect(alert).toBeVisible();
  await alert.getByRole("radio", { name: label, exact: true }).click();
  await alert.getByRole("button", { name: "Choose" }).click();
  await expect(alert).toBeHidden();
}

test.describe("with the device set to light", () => {
  test.use({ colorScheme: "light" });

  test("defaults to matching the device", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[data-testid=theme-select]");
    await expect
      .poll(() =>
        page
          .locator("[data-testid=theme-select]")
          .evaluate((s) => (s as unknown as { value: string }).value)
      )
      .toBe("system");
    expect(await paletteIsDark(page)).toBe(false);
  });

  test("goes dark when told to, regardless of the device", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[data-testid=theme-select]");
    const lightBackground = await backgroundColour(page);

    await chooseTheme(page, "Dark");

    await expect.poll(() => paletteIsDark(page)).toBe(true);
    // The class is only useful if it actually repaints, and Ionic's palette is
    // what does that - this fails if the stylesheet stops being imported.
    await expect.poll(() => backgroundColour(page)).not.toBe(lightBackground);
  });
});

test.describe("with the device set to dark", () => {
  test.use({ colorScheme: "dark" });

  test("follows the device by default", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[data-testid=theme-select]");
    await expect.poll(() => paletteIsDark(page)).toBe(true);
  });

  test("stays light when told to, regardless of the device", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("[data-testid=theme-select]");
    await chooseTheme(page, "Light");
    await expect.poll(() => paletteIsDark(page)).toBe(false);
  });

  test("keeps following the device when it changes", async ({ page }) => {
    // The old implementation read the device once at first launch and stored
    // the answer, so it never noticed a change. This is that bug.
    await page.goto("/");
    await page.waitForSelector("[data-testid=theme-select]");
    await expect.poll(() => paletteIsDark(page)).toBe(true);

    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => paletteIsDark(page)).toBe(false);

    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => paletteIsDark(page)).toBe(true);
  });
});

test.describe("dark after Maghrib", () => {
  test.use({ colorScheme: "light" });

  test("is offered alongside the standard three", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[data-testid=theme-select]");
    const options = await page
      .locator("[data-testid=theme-select] ion-select-option")
      .allInnerTexts();
    expect(options).toEqual([
      "Match device",
      "Light",
      "Dark",
      "Dark after Maghrib",
    ]);
  });

  test("goes dark after Maghrib, though the device is light", async ({
    page,
  }) => {
    // 23:30 in London on the 7th: past Isha (21:47) and well before sunrise,
    // with the device set to light - so only the timetable can explain dark.
    await page.clock.setFixedTime(new Date("2026-08-07T22:30:00Z"));
    await page.goto("/");
    await openSettings(page);
    await chooseTheme(page, "Dark after Maghrib");
    await expect.poll(() => paletteIsDark(page)).toBe(true);
  });

  test("is light during the day", async ({ page }) => {
    // 13:00 in London, before Duhr at 13:12 and long after sunrise.
    await page.clock.setFixedTime(new Date("2026-08-07T12:00:00Z"));
    await page.goto("/");
    await openSettings(page);
    await chooseTheme(page, "Dark after Maghrib");
    await expect.poll(() => paletteIsDark(page)).toBe(false);
  });
});
