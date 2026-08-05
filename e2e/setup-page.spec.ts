import { test, expect, type Page } from "@playwright/test";

// Regression tests for the setup screen's location picker, which broke twice:
//
//  1. The radio group used React's onChange. Ionic emits ionChange, so the
//     selection was never stored and the controlled value snapped back.
//  2. The markup used Ionic's pre-8 syntax - an ion-radio next to a sibling
//     ion-label inside an ion-item. Ionic 8 no longer associates those, so
//     only the radio dot was clickable and tapping the row did nothing.
//
// The second one is invisible to jsdom: it is about which element receives a
// click, inside shadow DOM. It needs a real browser.

const radioGroupValue = (page: Page) =>
  page.$eval("ion-radio-group", (g) => (g as unknown as { value: string }).value);

/** Clicks a row well away from the radio control, at its trailing edge. */
async function clickRowAwayFromControl(page: Page, label: string) {
  const row = page.locator("ion-item").filter({ hasText: label });
  const box = await row.boundingBox();
  if (!box) {
    throw new Error(`Could not find a row for ${label}`);
  }
  await page.mouse.click(box.x + box.width - 20, box.y + box.height / 2);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("ion-radio-group");
});

test("defaults to London", async ({ page }) => {
  expect(await radioGroupValue(page)).toBe("london");
});

test("selects Belfast when the radio control is clicked", async ({ page }) => {
  await page.locator("ion-radio[value=belfast]").click();
  await expect.poll(() => radioGroupValue(page)).toBe("belfast");
});

test("selects Belfast when the row is clicked away from the control", async ({
  page,
}) => {
  await clickRowAwayFromControl(page, "Belfast");
  await expect.poll(() => radioGroupValue(page)).toBe("belfast");
});

test("can switch back to London by row click", async ({ page }) => {
  await clickRowAwayFromControl(page, "Belfast");
  await expect.poll(() => radioGroupValue(page)).toBe("belfast");

  await clickRowAwayFromControl(page, "London");
  await expect.poll(() => radioGroupValue(page)).toBe("london");
});

test("carries the chosen location through to the settings step", async ({
  page,
}) => {
  await clickRowAwayFromControl(page, "Belfast");
  await expect.poll(() => radioGroupValue(page)).toBe("belfast");

  await page.getByRole("button", { name: "Next" }).click();

  const select = page.locator("ion-select");
  await expect(select).toBeVisible();
  await expect
    .poll(() =>
      select.evaluate((s) => (s as unknown as { value: string }).value)
    )
    .toBe("belfast");
});
