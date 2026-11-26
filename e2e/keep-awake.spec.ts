import { test, expect, type Page } from "@playwright/test";
import { PRAYER_STRIP, completeSetup, pinDate } from "./support/app";

// The lantern beside the settings cog keeps the screen on while the app is
// open (MEL-356). A tap opens it into a pill that says what happened, and
// five seconds later the pill folds the words away: to the lit lantern on its
// tinted circle while on, to the plain icon once off. On the
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

/**
 * The animated pill loads on its own once the app is idle (KeepAwakeButton),
 * standing in for the still one. The tests start once it has, so a tap never
 * lands on the swap; "taps keep working while the animation arrives" covers
 * that on purpose.
 */
async function waitForAnimation(page: Page) {
  await expect(page.getByTestId("keep-awake")).toHaveAttribute(
    "data-animated",
    "true",
    { timeout: 8000 }
  );
}

test.beforeEach(async ({ page }) => {
  await pinDate(page, NOON_ISH);
  await stubWakeLock(page);
  await completeSetup(page);
  await waitForAnimation(page);
});

/** The toolbar title's box, to show the pill never moves it. */
async function titleBox(page: Page) {
  return page
    .locator(".PageTitle")
    .first()
    .evaluate((el) => {
      const { left, top, width, height } = el.getBoundingClientRect();
      return { left, top, width, height };
    });
}

/**
 * What the pill shows, as painted: the words count as showing only when they
 * are opaque and wholly inside the pill. They are always laid out, clipped
 * and faded when not, so Playwright's own visibility would say yes.
 */
async function pillState(page: Page) {
  return page.getByTestId("keep-awake").evaluate((pill) => {
    const words = pill.querySelector("[data-testid=keep-awake-words]")!;
    const box = pill.getBoundingClientRect();
    const wordsBox = words.getBoundingClientRect();
    // The tint is drawn by a layer behind the contents (KeepAwakeButton.css).
    const style = getComputedStyle(pill, "::after");
    return {
      words: words.textContent,
      showing:
        parseFloat(getComputedStyle(words).opacity) > 0.95 &&
        wordsBox.left >= box.left - 0.5,
      width: box.width,
      height: box.height,
      tinted: style.backgroundColor !== "rgba(0, 0, 0, 0)",
    };
  });
}

/**
 * Samples the pill every frame for `ms`: its width, where the lantern is, and
 * how far the words' box reaches past the lantern's left edge.
 */
async function sampleFrames(page: Page, ms: number) {
  return page.getByTestId("keep-awake").evaluate(
    (pill, duration) =>
      new Promise<Array<{ width: number; icon: number; overlap: number }>>(
        (resolve) => {
          const icon = pill.querySelector(".KeepAwakeButton__icon")!;
          const words = pill.querySelector("[data-testid=keep-awake-words]")!;
          const frames: Array<{ width: number; icon: number; overlap: number }> = [];
          const start = performance.now();
          const frame = () => {
            const iconBox = icon.getBoundingClientRect();
            frames.push({
              width: pill.getBoundingClientRect().width,
              icon: iconBox.left,
              overlap: words.getBoundingClientRect().right - iconBox.left,
            });
            if (performance.now() - start < duration) requestAnimationFrame(frame);
            else resolve(frames);
          };
          requestAnimationFrame(frame);
        }
      ),
    ms
  );
}

/** Waits out the five seconds the words stay, plus the fold. */
async function waitForFold(page: Page) {
  await expect
    .poll(async () => (await pillState(page)).showing, { timeout: 8000 })
    .toBe(false);
  await page.waitForTimeout(600);
}

test("is off to begin with: the plain lantern, holding no lock", async ({ page }) => {
  await expect(button(page)).toHaveAttribute("aria-pressed", "false");
  const state = await pillState(page);
  expect(state.showing).toBe(false);
  expect(state.tinted).toBe(false);
  expect(Math.round(state.width)).toBe(36);
  expect(await wakeLock(page)).toEqual({ requests: 0, held: 0 });
});

test("a tap keeps the screen awake and says so in the toolbar", async ({ page }) => {
  const saved = page.getByText("Your settings have been saved");
  // Setup's own save shows it; wait that out first.
  await page.waitForTimeout(700);
  await expect(saved).toBeHidden();
  await button(page).click();
  await expect(button(page)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await pillState(page)).showing).toBe(true);
  expect((await pillState(page)).words).toBe("Screen always on");
  await expect.poll(async () => (await wakeLock(page)).held).toBe(1);
  // The pill says it, so the generic toast stays out of the way.
  await page.waitForTimeout(700);
  await expect(saved).toBeHidden();
});

test("after five seconds it folds to the lit lantern on its circle", async ({ page }) => {
  await button(page).click();
  await expect.poll(async () => (await pillState(page)).showing).toBe(true);
  // Still saying it well into the five seconds.
  await page.waitForTimeout(3500);
  expect((await pillState(page)).showing).toBe(true);
  await waitForFold(page);
  const state = await pillState(page);
  expect(Math.round(state.width)).toBe(36);
  expect(Math.round(state.height)).toBe(36);
  expect(state.tinted).toBe(true);
  await expect(button(page)).toHaveAttribute("aria-pressed", "true");
  expect((await wakeLock(page)).held).toBe(1);
});

test("turning it off says Screen normal, then folds to the plain icon", async ({
  page,
}) => {
  await button(page).click();
  await waitForFold(page);
  await button(page).click();
  await expect(button(page)).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await pillState(page)).showing).toBe(true);
  expect((await pillState(page)).words).toBe("Screen normal");
  await expect.poll(async () => (await wakeLock(page)).held).toBe(0);
  await waitForFold(page);
  const state = await pillState(page);
  expect(Math.round(state.width)).toBe(36);
  expect(state.tinted).toBe(false);
});

test("the lantern holds still and the words never cover it", async ({ page }) => {
  await waitForAnimation(page);
  const opening = sampleFrames(page, 700);
  await button(page).click();
  const open = await opening;
  await page.waitForTimeout(4000);
  const fold = await sampleFrames(page, 1800);
  for (const frames of [open, fold]) {
    const lefts = frames.map((f) => f.icon);
    expect(Math.max(...lefts) - Math.min(...lefts)).toBeLessThan(0.5);
    expect(Math.max(...frames.map((f) => f.overlap))).toBeLessThanOrEqual(0.5);
    // And the width really was animated, through sizes between the two.
    const widths = frames.map((f) => Math.round(f.width));
    const between = new Set(
      widths.filter((w) => w > 40 && w < Math.max(...widths) - 4)
    );
    expect(between.size).toBeGreaterThanOrEqual(3);
  }
});

test("with reduce motion, it changes size at once", async ({ page }) => {
  // Read when the app starts, as a phone's setting would be.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(700);
  await page.reload();
  await waitForAnimation(page);
  const opening = sampleFrames(page, 500);
  await button(page).click();
  const widths = (await opening).map((f) => Math.round(f.width));
  const between = widths.filter((w) => w > 40 && w < Math.max(...widths) - 4);
  expect(between).toEqual([]);
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
  // Lit on its circle, with nothing to say: nothing was tapped.
  const state = await pillState(page);
  expect(state.showing).toBe(false);
  expect(state.tinted).toBe(true);
  await expect.poll(async () => (await wakeLock(page)).held).toBe(1);
});

test("the open pill fits beside the cog, and never moves the title", async ({
  page,
}) => {
  await waitForAnimation(page);
  const before = await titleBox(page);
  await button(page).click();
  await expect.poll(async () => (await pillState(page)).showing).toBe(true);
  // Let the pill finish growing before measuring it.
  await page.waitForTimeout(600);
  const cog = page.locator("ion-button[router-link='/settings']");
  const pillBox = await button(page).boundingBox();
  const cogBox = await cog.boundingBox();
  const viewport = page.viewportSize();
  expect(pillBox && cogBox && viewport).toBeTruthy();
  expect(pillBox!.x + pillBox!.width).toBeLessThanOrEqual(cogBox!.x + 1);
  expect(cogBox!.x + cogBox!.width).toBeLessThanOrEqual(viewport!.width);
  await expect(page.getByText("Prayer Times").first()).toBeVisible();
  expect(await titleBox(page)).toEqual(before);
  // Tapping the words, not just the lantern, turns it off again.
  await page.getByTestId("keep-awake-words").click();
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

/** Whether every word of the toolbar's title is on one line. */
async function titleIsWhole(page: Page) {
  return page.locator(".PageTitle").first().evaluate((el) => {
    const range = document.createRange();
    const text = el.firstChild!;
    let offset = 0;
    for (const word of (el.textContent ?? "").split(" ")) {
      const lines = new Set<number>();
      for (let i = 0; i < word.length; i++) {
        range.setStart(text, offset + i);
        range.setEnd(text, offset + i + 1);
        lines.add(Math.round(range.getBoundingClientRect().top));
      }
      if (lines.size > 1) return false;
      offset += word.length + 1;
    }
    return true;
  });
}

test("the words grow with a larger text size, and fit", async ({ page }) => {
  await setTextSize(page, 1.25);
  await button(page).click();
  await expect.poll(async () => (await pillState(page)).showing).toBe(true);
  await page.waitForTimeout(600);
  const size = await page
    .getByTestId("keep-awake-words")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeCloseTo(14 * 1.25, 0);
  expect(await titleIsWhole(page)).toBe(true);
});

test("at a large text size the open pill lies over the title, never squeezing it", async ({
  page,
}) => {
  await setTextSize(page, 2);
  await waitForAnimation(page);
  const before = await titleBox(page);
  await button(page).click();
  await expect(button(page)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await pillState(page)).showing).toBe(true);
  await page.waitForTimeout(600);
  // The title is exactly where it was, whole, under the pill.
  expect(await titleBox(page)).toEqual(before);
  expect(await titleIsWhole(page)).toBe(true);
  const pillBox = (await button(page).boundingBox())!;
  const cogBox = (await page
    .locator("ion-button[router-link='/settings']")
    .boundingBox())!;
  expect(pillBox.x).toBeGreaterThanOrEqual(0);
  expect(pillBox.x + pillBox.width).toBeLessThanOrEqual(cogBox.x + 1);
  // The words are not cut off by the toolbar, and the pill is solid over the
  // title: what is painted at the words' middle is the pill.
  const painted = await page.getByTestId("keep-awake-words").evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + 4, box.top + box.height / 2);
    return hit != null && el.closest("button")!.contains(hit);
  });
  expect(painted).toBe(true);
  // It folds to its circle, which grows with the lantern and the cog.
  await waitForFold(page);
  const state = await pillState(page);
  expect(state.tinted).toBe(true);
  expect(state.width).toBeCloseTo(state.height, 0);
  expect(state.width).toBeGreaterThan(50);
  await expect.poll(async () => (await wakeLock(page)).held).toBe(1);
});

test.describe("before the animation has loaded", () => {
  test.beforeEach(async ({ page }) => {
    // Hold the animated pill back, as on a slow first start.
    await page.route("**/KeepAwakeMotion*", (route) => route.abort());
    // Setup's answers are written through a 500ms debounce.
    await page.waitForTimeout(700);
    await page.reload();
    await expect(button(page)).toBeVisible();
  });

  test("taps keep working while the animation arrives", async ({ page }) => {
    await page.unroute("**/KeepAwakeMotion*");
    // Turned on by the still pill. The touch starts loading the animated
    // one, which arrives while the words are showing.
    await expect(button(page)).not.toHaveAttribute("data-animated", "true");
    await button(page).click();
    await expect(button(page)).toHaveAttribute("aria-pressed", "true");
    await waitForAnimation(page);
    expect((await pillState(page)).words).toBe("Screen always on");
    // The fold that follows is animated, though the animated pill never saw
    // the tap that opened it.
    await page.waitForTimeout(3800);
    const fold = (await sampleFrames(page, 1800)).map((f) => Math.round(f.width));
    const between = new Set(fold.filter((w) => w > 40 && w < Math.max(...fold) - 4));
    expect(between.size).toBeGreaterThanOrEqual(3);
    await button(page).click();
    await expect(button(page)).toHaveAttribute("aria-pressed", "false");
    await expect.poll(async () => (await wakeLock(page)).held).toBe(0);
  });

  test("the still pill does everything but move", async ({ page }) => {
    await expect(button(page)).not.toHaveAttribute("data-animated", "true");
    await button(page).click();
    await expect(button(page)).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await pillState(page)).showing).toBe(true);
    expect((await pillState(page)).words).toBe("Screen always on");
    await expect.poll(async () => (await wakeLock(page)).held).toBe(1);
    await waitForFold(page);
    let state = await pillState(page);
    expect(Math.round(state.width)).toBe(36);
    expect(state.tinted).toBe(true);
    await button(page).click();
    await expect(button(page)).toHaveAttribute("aria-pressed", "false");
    expect((await pillState(page)).words).toBe("Screen normal");
    await expect.poll(async () => (await wakeLock(page)).held).toBe(0);
    await waitForFold(page);
    state = await pillState(page);
    expect(Math.round(state.width)).toBe(36);
    expect(state.tinted).toBe(false);
  });
});
