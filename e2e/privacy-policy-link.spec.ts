import { test, expect, type Page } from "@playwright/test";
import {
  completeSetup,
  openSettings as openSettingsScreen,
  openSetup,
} from "./support/app";

// The link lives in the shared SettingsList, so it has to appear on both the
// setup screen and the settings screen.

const POLICY_URL = "https://meltuhamy.com/privacy-policy/";

const policyLink = (page: Page) => page.getByTestId("privacy-policy-link");

async function openSettings(page: Page) {
  // The app shows setup until settings have been saved, so get past it first.
  await completeSetup(page);
  await openSettingsScreen(page);
}

for (const [screen, open] of [
  ["setup", openSetup],
  ["settings", openSettings],
] as const) {
  test(`shows the privacy policy link on the ${screen} screen`, async ({
    page,
  }) => {
    await open(page);
    await expect(policyLink(page)).toBeVisible();
    await expect(policyLink(page)).toContainText("Privacy policy");
    await expect(policyLink(page)).toContainText("No data leaves your device");
    await expect(policyLink(page)).toHaveAttribute("href", POLICY_URL);
  });

  test(`opens the policy outside the app from the ${screen} screen`, async ({
    page,
  }) => {
    // Without target="_blank" Capacitor navigates its own webview to the
    // policy, and there is no way back to the app from there.
    await open(page);
    await expect(policyLink(page)).toHaveAttribute("target", "_blank");
    await expect(policyLink(page)).toHaveAttribute("rel", /noopener/);
  });
}

test("makes the whole privacy row tappable", async ({ page }) => {
  await openSetup(page);
  const box = await policyLink(page).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});
