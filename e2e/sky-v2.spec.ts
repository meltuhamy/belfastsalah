import { test, expect, type Page } from "@playwright/test";
import {
  LOCATION_SELECT,
  PRAYER_STRIP,
  chooseFromSelect,
  goHome,
  openSettings,
  openSetup,
  pinDate,
} from "./support/app";

// Sky V2 (MEL-376): the real sky, drawn with WebGL, on the day card. The
// pixels come from a physical model, so these do not assert colours; they
// assert what the card decides from them - one text colour, judged on the
// pixels - and where things are: the horizon on the timeline's row.
//
// Istanbul, 27 November 2026, the prototype's day, on Istanbul's clock
// (UTC+3): Fajr 06:28, Shuruq 07:58, Duhr 12:57, Asr 15:23, Maghrib 17:45,
// Isha 19:10.

test.use({ colorScheme: "light", timezoneId: "Europe/Istanbul" });

const AFTERNOON = "2026-11-27T12:28:00Z"; // 15:28, Asr was 5m ago
const MORNING = "2026-11-27T08:00:00Z"; // 11:00, Duhr in 1h 57m
const NIGHT = "2026-11-27T19:30:00Z"; // 22:30

const card = (page: Page) => page.locator(".PrayerDayCard");

/** Sets up Istanbul on a new install, which starts on Sky V2. */
async function setUpIstanbul(page: Page) {
  await openSetup(page);
  await chooseFromSelect(page, LOCATION_SELECT, "Istanbul");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();
}

/** Waits until the card has drawn its sky and judged its text against it. */
async function judged(page: Page) {
  await expect(card(page)).toHaveAttribute("data-real-sky-tone", /black|white/);
}

const colourOf = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => getComputedStyle(el).color);

const TONES = { black: "rgb(0, 0, 0)", white: "rgb(255, 255, 255)" };

test("draws the real sky on a new install's day card", async ({ page }) => {
  await pinDate(page, AFTERNOON);
  await setUpIstanbul(page);
  await expect(page.getByTestId("real-sky-canvas")).toBeVisible();
  await expect(card(page)).toHaveClass(/PrayerDayCard--real-sky/);
  await judged(page);
  // Not the Sky theme's painted sun.
  await expect(page.getByTestId("sun")).toHaveCount(0);
});

test("switches between Sky V2 and Sky", async ({ page }) => {
  await pinDate(page, AFTERNOON);
  await setUpIstanbul(page);
  await judged(page);

  await openSettings(page);
  await chooseFromSelect(page, "[data-testid=theme-select]", "Sky");
  await goHome(page);
  await expect(page.getByTestId("real-sky")).toHaveCount(0);
  await expect(page.getByTestId("sun")).toHaveCount(1);

  await openSettings(page);
  await chooseFromSelect(page, "[data-testid=theme-select]", "Sky V2");
  await goHome(page);
  await expect(page.getByTestId("real-sky-canvas")).toBeVisible();
  await judged(page);
});

test("keeps Sky for someone who chose it before Sky V2", async ({ page }) => {
  await pinDate(page, AFTERNOON);
  await page.addInitScript(() =>
    localStorage.setItem(
      "CapacitorStorage.settings",
      JSON.stringify({ location: "istanbul", theme: "sky", timeZoneNoticeSeen: true })
    )
  );
  await page.goto("/");
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();
  await expect(page.getByTestId("sun")).toHaveCount(1);
  await expect(page.getByTestId("real-sky")).toHaveCount(0);
});

test("gives every word one colour, judged on the sky drawn", async ({ page }) => {
  await pinDate(page, MORNING);
  await setUpIstanbul(page);
  await judged(page);
  // A bright, hazy late morning over the sea: black text.
  await expect(card(page)).toHaveAttribute("data-real-sky-tone", "black");
  const tone = TONES.black;
  expect(await colourOf(page, "countdown")).toBe(tone);
  const cells = await page
    .getByTestId("strip-cell")
    .evaluateAll((all) => all.map((c) => getComputedStyle(c).color));
  expect(new Set(cells)).toEqual(new Set([tone]));
});

test("turns the text white at night, where it reads at 4.5:1", async ({ page }) => {
  await pinDate(page, NIGHT);
  await setUpIstanbul(page);
  await judged(page);
  await expect(card(page)).toHaveAttribute("data-real-sky-tone", "white");
  expect(await colourOf(page, "countdown")).toBe(TONES.white);
  const contrast = Number(await card(page).getAttribute("data-real-sky-contrast"));
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

/** The horizon the card drew, and the middle of the timeline's row, both up from the card's bottom. */
async function horizons(page: Page) {
  return card(page).evaluate((el) => {
    const box = el.getBoundingClientRect();
    const row = el.querySelector(".PrayerDayCard__timeline-row")!.getBoundingClientRect();
    const strip = el.querySelector(".PrayerDayCard__strip")!.getBoundingClientRect();
    const timelineShown = row.height > 0;
    return {
      drawn: Number((el as HTMLElement).dataset.realSkyHorizon),
      expected: box.bottom - (timelineShown ? row.top + row.height / 2 : strip.top),
      timelineShown,
    };
  });
}

test("puts the horizon on the timeline's row", async ({ page }) => {
  await pinDate(page, AFTERNOON);
  await setUpIstanbul(page);
  await judged(page);
  const h = await horizons(page);
  expect(h.timelineShown).toBe(true);
  expect(Math.abs(h.drawn - h.expected)).toBeLessThan(0.6);
});

test("keeps the horizon on the timeline's row at twice the text size", async ({ page }) => {
  await pinDate(page, AFTERNOON);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
  await setUpIstanbul(page);
  await judged(page);
  await expect
    .poll(async () => {
      const h = await horizons(page);
      return Math.abs(h.drawn - h.expected) < 0.6;
    })
    .toBe(true);
});

/** The frames the water's loop has drawn, which the card writes once a second. */
const waterFrames = (page: Page) =>
  page.getByTestId("real-sky-canvas").evaluate((el) => Number((el as HTMLElement).dataset.waterFrames ?? 0));

test("moves the water, a frame at a time", async ({ page }) => {
  await pinDate(page, AFTERNOON);
  await setUpIstanbul(page);
  await judged(page);
  const before = await waterFrames(page);
  await expect.poll(() => waterFrames(page)).toBeGreaterThan(before + 10);
});

test.describe("with reduce motion", () => {
  test("keeps the water still", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await pinDate(page, AFTERNOON);
    await setUpIstanbul(page);
    await judged(page);
    await page.waitForTimeout(1500);
    expect(await waterFrames(page)).toBe(0);
  });
});

test.describe("without WebGL", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        kind: string,
        ...rest: unknown[]
      ) {
        if (kind.startsWith("webgl")) return null;
        return (get as (...a: unknown[]) => unknown).call(this, kind, ...rest);
      } as typeof get;
    });
  });

  test("falls back to the Sky theme's painted sky", async ({ page }) => {
    await pinDate(page, AFTERNOON);
    await setUpIstanbul(page);
    await expect(page.getByTestId("sun")).toHaveCount(1);
    await expect(card(page)).not.toHaveClass(/PrayerDayCard--real-sky/);
  });
});
