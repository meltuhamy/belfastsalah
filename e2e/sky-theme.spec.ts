import { test, expect, type Page } from "@playwright/test";
import {
  LOCATION_SELECT,
  PRAYER_STRIP,
  chooseFromSelect,
  openSettings,
  openSetup,
  pinDate,
  paintedHighlight,
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

const card = (page: Page) => page.locator(".PrayerDayCard");

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

  // The highlight is the widgets' frosted pane, the bright one under black
  // text, and is still painted above the sky. At Duhr's own minute it is on
  // Duhr, whose adhan is being called.
  await expect(page.getByTestId("highlight-pane")).toHaveCSS(
    "background-color",
    "rgba(255, 255, 255, 0.55)"
  );
  expect(await paintedHighlight(page)).toBe("Duhr");

  // The card is the sky on the home screen; the day bar is for settings only.
  await expect(page.getByTestId("sky-day-bar")).toHaveCount(0);
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
  // Maghrib's adhan is being called, so its column is the highlighted one.
  expect(await paintedHighlight(page)).toBe("Maghrib");
});

test("brings the stars out at night and puts the sun away", async ({ page }) => {
  await pinDate(page, "2026-01-15T21:00:00Z");
  await setUpWithSky(page);

  await expect.poll(() => property(page, "--sky-night")).toBe("1.000");
  await expect(page.locator(".PrayerDayCard__stars")).toHaveCSS("opacity", "1");
  expect(await property(page, "--sky-sun-colour")).toBe("transparent");
});

test("opens on a different night sky each time, and turns it", async ({
  page,
}) => {
  await pinDate(page, "2026-01-15T21:00:00Z");
  await setUpWithSky(page);

  // The far layer's field; the others turn in step with it.
  const sky = page.locator('.StarField__tilt[data-depth="0"] .StarField__sky');
  await expect(sky).toBeVisible();
  // Something is painted: the field is wider than the card it turns behind.
  const field = await sky.boundingBox();
  const cardBox = await card(page).boundingBox();
  expect(field!.width).toBeGreaterThan(cardBox!.width);
  // A canvas for each of the two faint depths.
  await expect(page.locator(".StarField__faint")).toHaveCount(2);
  await expect(sky).toHaveCSS("animation-name", "StarField-turn");

  const angle = () =>
    sky.evaluate((el) => el.style.getPropertyValue("--start-angle"));
  const first = await angle();
  // Settings are written through a 500ms debounce; let them land first.
  await page.waitForTimeout(700);
  await page.reload();
  await expect(sky).toBeVisible();
  expect(await angle()).not.toBe(first);
});

test("shifts the stars by depth as the phone is tipped", async ({ page }) => {
  await pinDate(page, "2026-01-15T21:00:00Z");
  await setUpWithSky(page);
  const layer = (depth: number) =>
    page.locator(`.StarField__tilt[data-depth="${depth}"]`);
  await expect(layer(2)).toBeAttached();

  const tip = (beta: number, gamma: number) =>
    page.evaluate(
      ([b, g]) =>
        window.dispatchEvent(
          new DeviceOrientationEvent("deviceorientation", { beta: b, gamma: g })
        ),
      [beta, gamma]
    );
  const shift = (depth: number) =>
    layer(depth).evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return { x: m.m41, y: m.m42 };
    });

  // The first reading is the resting angle: nothing moves.
  await tip(40, 0);
  await page.waitForTimeout(300);
  expect(await shift(2)).toEqual({ x: 0, y: 0 });

  // Tipped right and towards the reader: every layer slides left and up, the
  // near stars furthest and the far ones least, by a few px at most.
  await tip(50, 10);
  await expect.poll(async () => (await shift(2)).x).toBeLessThan(-2);
  // Let the ease finish before comparing depths.
  await page.waitForTimeout(500);
  const far = await shift(0);
  const mid = await shift(1);
  const near = await shift(2);
  expect(far.x).toBeLessThan(0);
  expect(far.y).toBeLessThan(0);
  expect(Math.abs(mid.x)).toBeGreaterThan(Math.abs(far.x));
  expect(Math.abs(near.x)).toBeGreaterThan(Math.abs(mid.x));
  expect(Math.abs(near.x)).toBeLessThanOrEqual(10);
});

test("shows a faint lens flare by day that swings with the phone's tilt", async ({
  page,
}) => {
  await pinDate(page, "2026-01-15T14:50:00Z");
  await setUpWithSky(page);
  const flare = page.getByTestId("lens-flare");
  await expect(flare).toHaveCSS("opacity", "1");
  // (The flare fades with the sun, which goes in the ten minutes after Maghrib.)

  // The farthest ghost, which swings the most.
  const ghost = flare.locator(".LensFlare__ghost").last();
  const centre = () =>
    ghost.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  const tip = (beta: number, gamma: number) =>
    page.evaluate(
      ([b, g]) =>
        window.dispatchEvent(
          new DeviceOrientationEvent("deviceorientation", { beta: b, gamma: g })
        ),
      [beta, gamma]
    );

  await tip(40, 0);
  await page.waitForTimeout(400);
  const before = await centre();
  await tip(40, 15);
  await page.waitForTimeout(500);
  const after = await centre();
  // A drift, not a slide: it moves, but only a few px.
  expect(Math.abs(after.x - before.x)).toBeGreaterThan(2);
  expect(Math.abs(after.x - before.x)).toBeLessThan(15);
});

test("puts the sun and its flare away in the ten minutes after Maghrib", async ({
  page,
}) => {
  // 15 January 2026, Maghrib 16:24: half an hour on, as in the screenshot
  // that asked for it, the sky still has a sun but the card shows none.
  await pinDate(page, "2026-01-15T16:57:00Z");
  await setUpWithSky(page);
  await expect(page.locator(".PrayerDayCard__sun")).toHaveCSS("opacity", "0");
  await expect(page.getByTestId("lens-flare")).toHaveCSS("opacity", "0");
});

test("shows no sun before Shuruq, only the horizon warming", async ({
  page,
}) => {
  // 15 January 2026, Shuruq 07:57. Half an hour before, the sky's arc
  // already has a sun, low at the left, as in the screenshot that asked for
  // this to go; the card shows first light instead.
  await pinDate(page, "2026-01-15T07:30:00Z");
  await setUpWithSky(page);
  await expect(page.locator(".PrayerDayCard__sun")).toHaveCSS("opacity", "0");
  await expect(page.getByTestId("lens-flare")).toHaveCSS("opacity", "0");
  await expect
    .poll(async () =>
      Number(
        await page
          .getByTestId("dawn-glow")
          .evaluate((el) => getComputedStyle(el).opacity)
      )
    )
    .toBeGreaterThan(0.2);

  // From Shuruq the sun comes up, and the glow gives way to it.
  await page.clock.setFixedTime(new Date("2026-01-15T08:30:00Z"));
  await expect(page.locator(".PrayerDayCard__sun")).toHaveCSS("opacity", "1");
  await expect(page.getByTestId("dawn-glow")).toHaveCSS("opacity", "0");
});

test("draws Fajr's white thread in a haze, bright at Fajr, gone by Shuruq", async ({
  page,
}) => {
  // 15 January 2026, London: Fajr 06:20, Shuruq 07:57.
  const haze = page.getByTestId("fajr-haze");
  const line = page.getByTestId("fajr-line");
  const width = (locator: typeof haze) =>
    locator.evaluate((el) => el.getBoundingClientRect().width);

  // Fifteen minutes before: the haze, with the line inside it.
  await pinDate(page, "2026-01-15T06:05:00Z");
  await setUpWithSky(page);
  await expect.poll(() => width(haze)).toBeGreaterThan(100);
  await expect(haze).toHaveCSS("background-image", /radial-gradient/);
  await expect.poll(() => width(line)).toBeGreaterThan(50);
  await expect(line).not.toHaveClass(/--arriving/);

  // Fajr comes in: the line brightens once.
  await page.clock.setFixedTime(new Date("2026-01-15T06:20:00Z"));
  await expect(line).toHaveClass(/PrayerDayCard__fajr-line--arriving/);

  // From Shuruq: nothing.
  await page.clock.setFixedTime(new Date("2026-01-15T08:10:00Z"));
  await expect.poll(() => width(haze)).toBe(0);
  await expect.poll(() => width(line)).toBe(0);
});

test("puts the lens flare away at night", async ({ page }) => {
  await pinDate(page, "2026-01-15T21:30:00Z");
  await setUpWithSky(page);
  await expect(page.getByTestId("lens-flare")).toHaveCSS("opacity", "0");
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
          .querySelector(".PrayerDayCard")!
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
  // Sky is a new install's default, so setup opens on it.
  await pinDate(page, "2026-01-15T12:15:00Z");
  await openSetup(page);
  await expect.poll(() => htmlHas(page, "sky-theme")).toBe(true);

  await chooseTheme(page, "Light");
  await expect.poll(() => htmlHas(page, "sky-theme")).toBe(false);

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
