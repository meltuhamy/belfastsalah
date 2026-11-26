import { test, expect, type Page } from "@playwright/test";
import { PRAYER_STRIP, completeSetup, pinDate } from "./support/app";

// The lantern beside the settings cog keeps the screen on while the app is
// open (MEL-356), and grows into a "Screen On" pill while it does. On the
// web that is the Screen Wake Lock API, stood in for here
// so the spec can see what the page asked for: a headless browser has no
// screen to keep on, and may refuse the real thing.

const NOON_ISH = "2026-02-15T10:00:00Z";

async function stubWakeLock(page: Page) {
  await page.addInitScript(() => {
    const record = { requests: 0, held: 0 };
    (window as unknown as { __wakeLock: typeof record }).__wakeLock = record;
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          record.requests += 1;
          record.held += 1;
          const lock = {
            released: false,
            release: async () => {
              if (!lock.released) {
                lock.released = true;
                record.held -= 1;
              }
            },
          };
          return lock;
        },
      },
    });
  });
}

const wakeLock = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __wakeLock: { requests: number; held: number } })
        .__wakeLock
  );

const button = (page: Page) =>
  page.getByRole("button", { name: "Keep screen on" });

test.beforeEach(async ({ page }) => {
  await pinDate(page, NOON_ISH);
  await stubWakeLock(page);
  await completeSetup(page);
});

const pill = (page: Page) => page.getByText("Screen On", { exact: true });

test("is off to begin with, and holds no lock", async ({ page }) => {
  await expect(button(page)).toHaveAttribute("aria-pressed", "false");
  await expect(pill(page)).toBeHidden();
  expect(await wakeLock(page)).toEqual({ requests: 0, held: 0 });
});

test("keeps the screen awake when tapped, and says so in the toolbar", async ({ page }) => {
  const saved = page.getByText("Your settings have been saved");
  // Setup's own save shows it; wait that out first.
  await page.waitForTimeout(700);
  await expect(saved).toBeHidden();
  await button(page).click();
  await expect(button(page)).toHaveAttribute("aria-pressed", "true");
  await expect(pill(page)).toBeVisible();
  await expect.poll(async () => (await wakeLock(page)).held).toBe(1);
  // The pill says it, so the generic toast stays out of the way.
  await page.waitForTimeout(700);
  await expect(saved).toBeHidden();
});

test("lets the screen sleep again when tapped a second time", async ({
  page,
}) => {
  await button(page).click();
  await expect.poll(async () => (await wakeLock(page)).held).toBe(1);
  await button(page).click();
  await expect(button(page)).toHaveAttribute("aria-pressed", "false");
  await expect(pill(page)).toBeHidden();
  await expect.poll(async () => (await wakeLock(page)).held).toBe(0);
});

test("is remembered, and takes effect again on the next launch", async ({
  page,
}) => {
  await button(page).click();
  await expect(button(page)).toHaveAttribute("aria-pressed", "true");
  // Settings are written through a 500ms debounce.
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();
  await expect(button(page)).toHaveAttribute("aria-pressed", "true");
  await expect(pill(page)).toBeVisible();
  await expect.poll(async () => (await wakeLock(page)).held).toBe(1);
});

test("the pill fits beside the title and the cog", async ({ page }) => {
  await button(page).click();
  await expect(pill(page)).toBeVisible();
  // Let the pill finish growing before measuring it.
  await page.waitForTimeout(400);
  const cog = page.locator("ion-button[router-link='/settings']");
  const pillBox = await button(page).boundingBox();
  const cogBox = await cog.boundingBox();
  const viewport = page.viewportSize();
  expect(pillBox && cogBox && viewport).toBeTruthy();
  expect(pillBox!.x + pillBox!.width).toBeLessThanOrEqual(cogBox!.x + 1);
  expect(cogBox!.x + cogBox!.width).toBeLessThanOrEqual(viewport!.width);
  await expect(page.getByText("Prayer Times").first()).toBeVisible();
  // Tapping the pill itself, not just the icon, turns it off.
  await pill(page).click();
  await expect(button(page)).toHaveAttribute("aria-pressed", "false");
});

/** Chrome's text size, as in text-size.spec.ts; reloads to apply it. */
async function setTextSize(page: Page, scale: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: 16 * scale } });
  // Setup's answers are written through a 500ms debounce.
  await page.waitForTimeout(700);
  await page.reload();
  await expect(button(page)).toBeVisible();
}

/** Words in the toolbar's title, as laid out: a word split over lines fails. */
async function titleIsWhole(page: Page) {
  return page.locator(".PageTitle").first().evaluate((el) => {
    const range = document.createRange();
    const text = el.firstChild!;
    const tops = new Set<number>();
    const words: Array<Set<number>> = [];
    let offset = 0;
    for (const word of (el.textContent ?? "").split(" ")) {
      const lines = new Set<number>();
      for (let i = 0; i < word.length; i++) {
        range.setStart(text, offset + i);
        range.setEnd(text, offset + i + 1);
        lines.add(Math.round(range.getBoundingClientRect().top));
      }
      words.push(lines);
      lines.forEach((t) => tops.add(t));
      offset += word.length + 1;
    }
    return words.every((lines) => lines.size === 1);
  });
}

test("the label grows with a larger text size, still whole", async ({ page }) => {
  await setTextSize(page, 1.25);
  await button(page).click();
  await expect(pill(page)).toBeVisible();
  await page.waitForTimeout(400);
  const label = await pill(page).evaluate((el) => ({
    clipped: el.scrollWidth > el.clientWidth + 1,
    size: parseFloat(getComputedStyle(el).fontSize),
  }));
  expect(label.clipped).toBe(false);
  expect(label.size).toBeCloseTo(14 * 1.25, 0);
  expect(await titleIsWhole(page)).toBe(true);
});

test("at a large text size it stays a lit lantern, leaving the title room", async ({
  page,
}) => {
  await setTextSize(page, 2);
  await button(page).click();
  await expect(button(page)).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(400);
  await expect(pill(page)).toBeHidden();
  await expect.poll(async () => (await wakeLock(page)).held).toBe(1);
  expect(await titleIsWhole(page)).toBe(true);
  const cog = page.locator("ion-button[router-link='/settings']");
  const pillBox = await button(page).boundingBox();
  const cogBox = await cog.boundingBox();
  expect(pillBox!.x + pillBox!.width).toBeLessThanOrEqual(cogBox!.x + 1);
  expect(cogBox!.x + cogBox!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width
  );
});
