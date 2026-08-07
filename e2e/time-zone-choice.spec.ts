import { test, expect, type Page } from "@playwright/test";

// The app renders the timetable's own clock, not the device's. Away from the
// UK those are different numbers, so there is a one-off prompt, a standing
// caption, and a setting to switch. All three are Ionic controls in shadow
// DOM, and the prompt only exists on a device whose zone disagrees - neither
// is something a jsdom test can answer, so the behaviour is covered here.

/** The times as rendered on the today card, e.g. ["04:32", "06:12", ...]. */
const shownTimes = (page: Page) =>
  page.locator(".DayPrayerTable__col--time").allInnerTexts();

async function completeSetup(page: Page) {
  await page.goto("/");
  await page.waitForSelector("[data-testid=location-select]");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Done" })).toHaveCount(0);
}

test.describe("on a device far from the timetable's clock", () => {
  // Dubai is four hours ahead of London and never shares its clock, so the
  // difference holds whatever time of year the suite runs.
  test.use({ timezoneId: "Asia/Dubai" });

  test("offers the choice during setup, defaulting to timetable time", async ({
    page,
  }) => {
    await page.goto("/");
    const zoneSelect = page.locator("[data-testid=display-zone-select]");
    await expect(zoneSelect).toBeVisible();
    // false means the timetable's own clock - the printed times.
    await expect
      .poll(() =>
        zoneSelect.evaluate((s) => (s as unknown as { value: boolean }).value)
      )
      .toBe(false);
    await expect(page.getByText("Gulf Standard Time")).toBeVisible();
  });

  test("prompts once on the home screen and captions the times", async ({
    page,
  }) => {
    await completeSetup(page);

    const notice = page.locator("[data-testid=time-zone-notice]");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Your device isn't on London time");

    await expect(page.locator("[data-testid=display-zone-caption]")).toHaveText(
      "Showing London time"
    );
  });

  test("switches the clock when the prompt is accepted", async ({ page }) => {
    await completeSetup(page);
    await expect(page.locator("[data-testid=display-zone-caption]")).toBeVisible();
    const londonTimes = await shownTimes(page);
    expect(londonTimes.length).toBeGreaterThan(0);

    await page.locator("[data-testid=time-zone-notice-use-device]").click();

    // Nothing left to explain once the times match the device's own clock.
    await expect(page.locator("[data-testid=time-zone-notice]")).toHaveCount(0);
    await expect(page.locator("[data-testid=display-zone-caption]")).toHaveCount(
      0
    );
    await expect.poll(() => shownTimes(page)).not.toEqual(londonTimes);
  });

  test("keeps timetable time when the prompt is declined, and stays quiet after", async ({
    page,
  }) => {
    await completeSetup(page);
    const londonTimes = await shownTimes(page);

    await page.locator("[data-testid=time-zone-notice-dismiss]").click();
    await expect(page.locator("[data-testid=time-zone-notice]")).toHaveCount(0);

    // Declined is an answer, not a deferral: the times stay as they were and
    // the prompt does not come back, though the caption still labels them.
    expect(await shownTimes(page)).toEqual(londonTimes);
    await expect(page.locator("[data-testid=display-zone-caption]")).toBeVisible();

    // Settings writes are debounced by 500ms, so give the answer time to
    // reach storage before throwing the page away.
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.locator("[data-testid=display-zone-caption]")).toBeVisible();
    await expect(page.locator("[data-testid=time-zone-notice]")).toHaveCount(0);
  });

  test("can still switch from settings after declining", async ({ page }) => {
    await completeSetup(page);
    await page.locator("[data-testid=time-zone-notice-dismiss]").click();

    await page.locator("ion-button[router-link='/settings']").click();
    const zoneRow = page
      .locator("ion-item")
      .filter({ has: page.locator("[data-testid=display-zone-select]") });
    await expect(zoneRow).toBeVisible();

    // Tap the row away from the control, the way the location row is tested:
    // the whole row has to open the picker, not just the select's own text.
    // Locator.tap rather than raw coordinates so it waits out the page
    // transition instead of aiming at where the row used to be.
    const box = await zoneRow.boundingBox();
    await zoneRow.tap({
      position: { x: box!.width - 20, y: box!.height / 2 },
    });

    const alert = page.locator("ion-alert");
    await expect(alert).toBeVisible();
    await alert.getByRole("radio", { name: "My clock" }).click();
    await alert.getByRole("button", { name: "Choose" }).click();
    await expect(alert).toBeHidden();

    await page.locator("ion-button[router-link='/']").click();
    await expect(page.locator("[data-testid=display-zone-caption]")).toHaveCount(
      0
    );
  });
});

test.describe("on a device sharing the timetable's clock", () => {
  // Dublin is a different zone by name but shows the same time all year, so
  // there is nothing to ask about. This is the case that a name comparison
  // would get wrong.
  test.use({ timezoneId: "Europe/Dublin" });

  test("says nothing at all about timezones", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[data-testid=location-select]");
    await expect(
      page.locator("[data-testid=display-zone-select]")
    ).toHaveCount(0);

    await completeSetup(page);
    await expect(page.locator("[data-testid=time-zone-notice]")).toHaveCount(0);
    await expect(page.locator("[data-testid=display-zone-caption]")).toHaveCount(
      0
    );
  });
});
