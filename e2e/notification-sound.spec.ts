import { test, expect, type Page } from "@playwright/test";
import { completeSetup, openSettings, pinDate, toggle } from "./support/app";

// Each prayer's reminder - on or off, when, which sound - and the test day.
// What a tap reaches, what reaches the network when a sound is chosen, and
// a day playing out on the timeline are real-browser concerns, hence e2e.

// The reminder switch only stays on if the permission request is granted.
test.use({ permissions: ["notifications"] });

// 15 January, GMT, so the times are london-2026.json's own:
// Fajr 06:20, Shuruq 07:57, Duhr 12:15, Asr 14:02, Maghrib 16:24, Isha 18:01.
const EARLY = "2026-01-15T03:00:00Z";

async function notificationSettings(page: Page) {
  await completeSetup(page);
  await openSettings(page);
  await toggle(page, "Prayer Notifications");
  await page.getByTestId("notification-settings-row").click();
  await expect(page.getByTestId("reminder-row-fajr")).toBeVisible();
}

async function openPrayer(page: Page, key: string) {
  await page.getByTestId(`reminder-row-${key}`).click();
  await expect(page.getByTestId("reminder-on")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await pinDate(page, EARLY);
});

test("offers no Notification Settings while reminders are off", async ({ page }) => {
  await completeSetup(page);
  await openSettings(page);
  await expect(page.getByTestId("notification-settings-row")).toHaveCount(0);
});

test("starts every prayer five minutes before, on the phone's sound", async ({ page }) => {
  await notificationSettings(page);
  for (const key of ["fajr", "shuruq", "duhr", "asr", "maghrib", "isha"]) {
    const row = page.getByTestId(`reminder-row-${key}`);
    await expect(row).toContainText("Default sound");
    await expect(row).toContainText("5 min before");
  }
  await expect(page.getByTestId("reminder-row-all")).toContainText("Default sound");
});

test("lists the adhans by number only, and chooses one without playing it", async ({ page }) => {
  await notificationSettings(page);
  await openPrayer(page, "fajr");

  const labels = await page.locator("[data-testid^=sound-option-] ion-label").allInnerTexts();
  expect(labels.map((l) => l.trim())).toEqual([
    "Default sound",
    "Silent",
    "Adhan 1",
    "Adhan 2",
    "Adhan 3",
    "Adhan 4",
    "Adhan 5",
  ]);

  const sounds: Array<string> = [];
  page.on("request", (request) => {
    if (request.url().includes("/sounds/")) sounds.push(request.url());
  });
  await page.getByTestId("sound-option-adhan-3").click();
  await expect(page.getByTestId("sound-option-adhan-3")).toHaveClass(/reminder-editor__sound--selected/);
  await page.waitForTimeout(300);
  expect(sounds).toEqual([]);
});

test("plays a sound from its speaker, without choosing it", async ({ page }) => {
  await notificationSettings(page);
  await openPrayer(page, "fajr");

  const played = page.waitForRequest(/\/sounds\/adhan-2\.mp3$/);
  await page.getByTestId("sound-listen-adhan-2").click();
  await played;
  await expect(page.getByTestId("sound-listen-adhan-2")).toHaveAttribute("aria-label", "Stop Adhan 2");
  await expect(page.getByTestId("sound-option-default")).toHaveClass(/reminder-editor__sound--selected/);
  await expect(page.getByTestId("sound-option-adhan-2")).not.toHaveClass(/reminder-editor__sound--selected/);

  await page.getByTestId("sound-listen-adhan-2").click();
  await expect(page.getByTestId("sound-listen-adhan-2")).toHaveAttribute("aria-label", "Play Adhan 2");
});

test("has no speaker for silence, nor for the phone's sound on the web", async ({ page }) => {
  await notificationSettings(page);
  await openPrayer(page, "fajr");
  await expect(page.getByTestId("sound-listen-adhan-1")).toBeVisible();
  await expect(page.getByTestId("sound-listen-silent")).toHaveCount(0);
  await expect(page.getByTestId("sound-listen-default")).toHaveCount(0);
});

test("applies one prayer's reminder to every prayer, once confirmed", async ({ page }) => {
  await notificationSettings(page);
  await openPrayer(page, "maghrib");
  await page.getByTestId("sound-option-adhan-4").click();

  // Cancelling changes nothing.
  await page.getByTestId("apply-to-all").click();
  const alert = page.locator("ion-alert");
  await expect(alert).toContainText("Every prayer will be set like Maghrib: Adhan 4, 5 min before.");
  await alert.getByRole("button", { name: "Cancel" }).click();
  await expect(alert).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId("reminder-row-fajr")).toContainText("Default sound");

  await openPrayer(page, "maghrib");
  await page.getByTestId("apply-to-all").click();
  await page.locator("ion-alert").getByRole("button", { name: "Apply" }).click();
  await page.goBack();
  for (const key of ["fajr", "shuruq", "duhr", "asr", "maghrib", "isha"]) {
    await expect(page.getByTestId(`reminder-row-${key}`)).toContainText("Adhan 4");
  }
  await expect(page.getByTestId("reminder-row-all")).toContainText("Adhan 4");
});

test("offers Apply to all only on one prayer's screen", async ({ page }) => {
  await notificationSettings(page);
  await page.getByTestId("reminder-row-all").click();
  await expect(page.getByTestId("reminder-on")).toBeVisible();
  await expect(page.getByTestId("apply-to-all")).toHaveCount(0);
});

test("shows today's prayer and reminder time as the timing changes", async ({ page }) => {
  await notificationSettings(page);
  await openPrayer(page, "fajr");
  await expect(page.getByTestId("reminder-when")).toHaveText("5 minutes before Fajr");
  await expect(page.getByTestId("reminder-times")).toHaveText("Fajr: 06:20. Reminder: 06:15");
});

test("leaves appearance to the phone, so the web has no row for it", async ({ page }) => {
  await notificationSettings(page);
  await openPrayer(page, "fajr");
  await expect(page.getByTestId("sound-option-default")).toBeVisible();
  await expect(page.getByTestId("reminder-appearance")).toHaveCount(0);
});

test("turns one prayer off, and shows it off in the list", async ({ page }) => {
  await notificationSettings(page);
  await openPrayer(page, "shuruq");
  await page.locator("ion-toggle").filter({ hasText: "Shuruq notification" }).click();
  await expect(page.getByTestId("reminder-when")).toHaveCount(0);
  await expect(page.getByText("No notification for Shuruq")).toBeVisible();

  await page.goBack();
  await expect(page.getByTestId("reminder-row-shuruq")).toContainText("Off");
  await expect(page.getByTestId("reminder-row-fajr")).toContainText("Default sound");
  await expect(page.getByTestId("reminder-row-all")).toContainText("Mixed");
});

test("sets every prayer at once from All prayers", async ({ page }) => {
  await notificationSettings(page);
  await page.getByTestId("reminder-row-all").click();
  await page.getByTestId("sound-option-adhan-2").click();
  await page.goBack();
  for (const key of ["fajr", "shuruq", "duhr", "asr", "maghrib", "isha"]) {
    await expect(page.getByTestId(`reminder-row-${key}`)).toContainText("Adhan 2");
  }
});

test("gives every prayer Fajr's sound from All prayers when they differ", async ({ page }) => {
  await notificationSettings(page);
  await openPrayer(page, "fajr");
  await page.getByTestId("sound-option-adhan-4").click();
  await page.goBack();

  await page.getByTestId("reminder-row-all").click();
  // The prayers differ, so no sound is shown as chosen, not even Fajr's.
  await expect(page.locator(".reminder-editor__sound--selected")).toHaveCount(0);
  await page.getByTestId("sound-option-adhan-4").click();
  await expect(page.getByTestId("sound-option-adhan-4")).toHaveClass(/reminder-editor__sound--selected/);
  await page.goBack();
  for (const key of ["fajr", "shuruq", "duhr", "asr", "maghrib", "isha"]) {
    await expect(page.getByTestId(`reminder-row-${key}`)).toContainText("Adhan 4");
  }
});

test("says the timing differs on All prayers rather than showing Fajr's", async ({ page }) => {
  await notificationSettings(page);
  await openPrayer(page, "fajr");
  await page.getByTestId("reminder-offset").getByRole("slider").press("ArrowLeft");
  await expect(page.getByTestId("reminder-when")).toHaveText("6 minutes before Fajr");
  await page.goBack();

  await page.getByTestId("reminder-row-all").click();
  await expect(page.getByTestId("reminder-when")).toHaveText(
    "Different for each prayer. Move the slider to set them all."
  );
});

test("remembers each prayer's sound", async ({ page }) => {
  await notificationSettings(page);
  await openPrayer(page, "isha");
  await page.getByTestId("sound-option-silent").click();

  // Settings are written through a 500ms debounce.
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByTestId("sound-option-silent")).toHaveClass(/reminder-editor__sound--selected/);
});

test("serves every adhan's sound", async ({ page, baseURL }) => {
  for (let n = 1; n <= 5; n++) {
    const response = await page.request.get(`${baseURL}/sounds/adhan-${n}.mp3`);
    expect(response.status(), `adhan-${n}.mp3`).toBe(200);
    expect(response.headers()["content-type"]).toContain("audio");
  }
});

test.describe("test it out", () => {
  async function openTestDay(page: Page) {
    await notificationSettings(page);
    await page.getByTestId("test-it-out").click();
    await expect(page.getByTestId("test-day-play")).toBeVisible();
  }

  test("plays the day to the first reminder, and shows its notification", async ({ page }) => {
    await openTestDay(page);
    await expect(page.getByTestId("test-day-status")).toHaveText("Next: Fajr reminder at 06:15");

    await page.getByTestId("test-day-play").click();
    // The web has no notifications, so the page shows its own.
    const banner = page.getByTestId("test-day-banner");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText("Fajr is at 06:20");
    await expect(banner).toContainText("In 5 minutes");
    await expect(page.getByTestId("test-day-clock")).toHaveText("06:15");
    await expect(page.getByTestId("test-day-status")).toHaveText(
      "Fajr reminder · playing Default sound"
    );
    // While the sound plays, the play button shows the adhan icon.
    await expect(page.getByTestId("test-day-play").getByTestId("adhan-icon")).toBeVisible();
    await expect(page.getByTestId("test-day-dot-fajr")).toHaveAttribute("data-sent", "true");
  });

  test("plays to the first reminder when the page is loaded on its own", async ({ page }) => {
    await notificationSettings(page);
    // Settings are written through a 500ms debounce.
    await page.waitForTimeout(700);
    // Straight to the page, so its timer starts before today's times load.
    await page.goto("/settings/notifications/test");
    await page.getByTestId("test-day-play").click();
    await expect(page.getByTestId("test-day-banner")).toContainText("Fajr is at 06:20", {
      timeout: 15_000,
    });
  });

  test("snaps the timeline to a prayer when it is tapped", async ({ page }) => {
    await openTestDay(page);
    const timeline = page.getByTestId("test-day-timeline");
    const box = (await timeline.boundingBox())!;
    // Asr's slot is the fourth of six.
    await timeline.click({ position: { x: box.width * (3.5 / 6) + 3, y: box.height / 2 } });

    await expect(page.getByTestId("test-day-status")).toHaveText("Next: Asr reminder at 13:57");
    // Earlier prayers' reminders count as sent.
    await expect(page.getByTestId("test-day-dot-duhr")).toHaveAttribute("data-sent", "true");
    await expect(page.getByTestId("test-day-dot-asr")).toHaveAttribute("data-sent", "false");
  });

  test("steps between prayers with the arrow keys", async ({ page }) => {
    await openTestDay(page);
    const timeline = page.getByTestId("test-day-timeline");
    await timeline.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("test-day-status")).toHaveText("Next: Duhr reminder at 12:10");
  });

  test("changes a prayer's reminder from the day", async ({ page }) => {
    await openTestDay(page);
    await page.getByTestId("test-day-cell-maghrib").click();
    await page.getByTestId("sound-option-adhan-4").click();
    await expect(page.getByTestId("test-day-cell-maghrib")).toContainText("Adhan 4");
  });
});
