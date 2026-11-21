import { test, expect, type Page } from "@playwright/test";
import {
  LOCATION_SELECT,
  PRAYER_STRIP,
  chooseFromSelect,
  openSettings,
  openSetup,
  pinDate,
  tailTarget,
} from "./support/app";

// The Sky theme paints the countdown card as the sky for the moment, worked
// out by src/lib/sky.ts from the day's prayer times. These pin the clock to
// the instants of the sky's own points, where its colours are exactly the ones
// written in sky.ts, and read back what the browser actually painted.
//
// 15 January 2026, all GMT: Fajr 06:20, Shuruq 07:57, Duhr 12:15, Asr 14:02,
// Maghrib 16:24, Isha 18:01.

test.use({ colorScheme: "light" });

const chooseTheme = (page: Page, label: string) =>
  chooseFromSelect(page, "[data-testid=theme-select]", label);

/** Picks Sky on the setup screen and finishes setup. */
async function setUpWithSky(page: Page) {
  await openSetup(page);
  await chooseTheme(page, "Sky");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();
}

const card = (page: Page) => page.locator(".PrayerDayCard__bubble");

const cardStyle = (page: Page) =>
  card(page).evaluate((el) => {
    const style = getComputedStyle(el);
    return { background: style.backgroundImage, colour: style.color };
  });

const property = (page: Page, name: string) =>
  page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name
  );

const htmlHas = (page: Page, className: string) =>
  page.evaluate(
    (c) => document.documentElement.classList.contains(c),
    className
  );

test("paints the card as the midday sky at Duhr, with dark text", async ({
  page,
}) => {
  await pinDate(page, "2026-01-15T12:15:00Z");
  await setUpWithSky(page);

  // sky.ts's midday point: #4f9ae4, #7dbbef, #b9def8.
  await expect
    .poll(async () => (await cardStyle(page)).background)
    .toBe(
      "linear-gradient(rgb(79, 154, 228) 0%, rgb(125, 187, 239) 62%, rgb(185, 222, 248) 100%)"
    );
  expect((await cardStyle(page)).colour).toBe("rgb(0, 0, 0)");
  expect(await htmlHas(page, "ion-palette-dark")).toBe(false);

  // The sky must not cost the card its tail, which still points at Asr.
  expect(await tailTarget(page)).toEqual({ painted: true, column: "Asr" });

  // Asr's highlight in the strip is a piece of the same sky.
  const highlight = page.locator("[data-testid=strip-cell][data-next=true]");
  await expect(highlight).toHaveCSS(
    "background-image",
    "linear-gradient(170deg, rgb(125, 187, 239), rgb(185, 222, 248))"
  );

  await expect(page.getByTestId("sky-day-bar")).toBeVisible();
});

test("goes dark at Maghrib, with light text on the sunset", async ({ page }) => {
  await pinDate(page, "2026-01-15T16:24:00Z");
  await setUpWithSky(page);

  // sky.ts's sunset point: #2b2f66, #7e4373, #a9492b.
  await expect
    .poll(async () => (await cardStyle(page)).background)
    .toContain("rgb(43, 47, 102) 0%");
  expect((await cardStyle(page)).colour).toBe("rgb(255, 255, 255)");
  await expect.poll(() => htmlHas(page, "ion-palette-dark")).toBe(true);
  expect(await tailTarget(page)).toEqual({ painted: true, column: "Isha" });
});

test("brings the stars out at night and puts the sun away", async ({ page }) => {
  await pinDate(page, "2026-01-15T21:00:00Z");
  await setUpWithSky(page);

  await expect.poll(() => property(page, "--sky-night")).toBe("1.000");
  await expect(page.locator(".PrayerDayCard__stars")).toHaveCSS("opacity", "1");
  expect(await property(page, "--sky-sun-colour")).toBe("transparent");
});

test("shows the sun on the card during the day", async ({ page }) => {
  await pinDate(page, "2026-01-15T12:15:00Z");
  await setUpWithSky(page);

  // Painted, not just present: something has to be at the sun's centre
  // that is the sun, or the card's clipping has swallowed it.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const sun = document.querySelector(".PrayerDayCard__sun")!;
        const box = sun.getBoundingClientRect();
        const bubble = document
          .querySelector(".PrayerDayCard__bubble")!
          .getBoundingClientRect();
        return (
          box.width > 0 &&
          box.top >= bubble.top &&
          box.bottom <= bubble.bottom &&
          getComputedStyle(sun).backgroundColor !== "rgba(0, 0, 0, 0)"
        );
      })
    )
    .toBe(true);
});

test("previews on the setup screen before it is saved", async ({ page }) => {
  // Setup has no location stored yet, so this is London's day standing in.
  await pinDate(page, "2026-01-15T12:15:00Z");
  await openSetup(page);
  expect(await htmlHas(page, "sky-theme")).toBe(false);

  await chooseTheme(page, "Sky");

  await expect.poll(() => htmlHas(page, "sky-theme")).toBe(true);
  await expect.poll(() => property(page, "--sky-top")).toBe("#4f9ae4");
  await expect(page.getByTestId("sky-day-bar")).toBeVisible();
  // The day bar sits under the theme row, and the picker above it still works.
  await expect(page.locator(LOCATION_SELECT)).toBeVisible();
});

test("takes its colours away when another theme is chosen", async ({ page }) => {
  await pinDate(page, "2026-01-15T12:15:00Z");
  await setUpWithSky(page);
  await expect.poll(() => htmlHas(page, "sky-theme")).toBe(true);

  await openSettings(page);
  await chooseTheme(page, "Light");

  await expect.poll(() => htmlHas(page, "sky-theme")).toBe(false);
  expect(await property(page, "--sky-top")).toBe("");
  await expect(page.getByTestId("sky-day-bar")).toHaveCount(0);
});

// ion-card-header lays its children out in reverse in iOS mode, which once put
// the day bar above the month's name on iPhones only. The rest of the suite
// runs in Android's mode, so this one asks for iOS's.
test("keeps the day bar under the month's name in iOS mode", async ({ page }) => {
  await pinDate(page, "2026-01-15T12:15:00Z");
  await setUpWithSky(page);
  // Settings are written through a 500ms debounce; let them land first.
  await page.waitForTimeout(700);
  await page.goto("/?ionic:mode=ios");
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();

  const bar = await page.getByTestId("sky-day-bar").boundingBox();
  const month = await page
    .locator(".HomePage__month-card ion-card-subtitle")
    .boundingBox();
  expect(bar!.y).toBeGreaterThan(month!.y + month!.height);
});
