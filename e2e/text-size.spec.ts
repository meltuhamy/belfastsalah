import { test, expect, type Page } from "@playwright/test";
import {
  completeSetup,
  openSettings,
  pinDate,
  PRAYER_STRIP,
  nextDaysRows,
  openMonth,
  todayTimes,
  waitForNextDays,
} from "./support/app";

// The system text size (MEL-105). On the web that is the browser's own font
// size, which `medium` resolves to - set here through Chrome's DevTools
// protocol, the same setting a reader changes in the browser's settings. The
// phones feed the same number in from Dynamic Type and Android's font scale
// (textScale.ts), so what is checked here is the layout they get.

// 15 January 2026, a winter afternoon: Asr is next. Times from
// src/prayer_data/london-2026.json, row 1/15 (Shafi'i Asr).
const AFTERNOON = "2026-01-15T14:00:00Z";
const TIMES = {
  Fajr: "06:20",
  Shuruq: "07:57",
  Duhr: "12:15",
  Asr: "14:02",
  Maghrib: "16:24",
  Isha: "18:01",
};

/** The browser's text size, as a multiple of its 16px default. */
async function setTextSize(page: Page, scale: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: 16 * scale } });
}

/** The strip's cells' boxes, in the order Fajr to Isha. */
async function cellBoxes(page: Page) {
  return page.locator("[data-testid=strip-cell]").evaluateAll((cells) =>
    cells.map((cell) => {
      const { left, right, top, bottom } = cell.getBoundingClientRect();
      return { left, right, top, bottom };
    })
  );
}

/**
 * Whether any two of the Next 7 days card's columns overlap: each time's box
 * against its neighbour's, row by row.
 */
async function columnsOverlap(page: Page) {
  return page.locator("[data-testid=next-day]").evaluateAll((rows) =>
    rows.some((row) => {
      const cells = Array.from(
        row.querySelectorAll(".NextDaysCard__time, .NextDaysCard__date")
      ).map((cell) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        return range.getBoundingClientRect();
      });
      return cells.some(
        (cell, i) => i > 0 && cell.left < cells[i - 1].right - 0.5
      );
    })
  );
}

/** Whether anything has made the page scroll sideways. */
async function widerThanPage(page: Page) {
  return page.evaluate(() => {
    const content = document.querySelector("ion-content");
    const scroller = content?.shadowRoot?.querySelector(".inner-scroll");
    return (
      document.documentElement.scrollWidth > window.innerWidth + 1 ||
      (scroller != null && scroller.scrollWidth > scroller.clientWidth + 1)
    );
  });
}

/** The Next 7 days card's text and boxes, leaving out its hidden probes. */
const NEXT_DAYS_TEXT = [
  ".NextDaysCard__header *",
  ".NextDaysCard__blocks *",
  ".NextDaysCard__table *",
].join(", ");

/** Text in the strip or the month table that does not fit its box. */
async function clippedText(page: Page, selector: string) {
  return page
    .locator(selector)
    .evaluateAll((elements) =>
      elements
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.textContent)
    );
}

test.describe("at the default text size", () => {
  test.beforeEach(async ({ page }) => {
    await pinDate(page, AFTERNOON);
    await completeSetup(page);
  });

  test("keeps the six times in one row", async ({ page }) => {
    expect(await todayTimes(page)).toEqual(TIMES);
    const boxes = await cellBoxes(page);
    expect(new Set(boxes.map((b) => Math.round(b.top))).size).toBe(1);
    await expect(page.locator(".PrayerDayCard--rows")).toHaveCount(0);
  });

  test("keeps one row on a 375px phone, the narrowest in use", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator(PRAYER_STRIP)).toBeVisible();
    const boxes = await cellBoxes(page);
    expect(new Set(boxes.map((b) => Math.round(b.top))).size).toBe(1);
    expect(
      await clippedText(
        page,
        ".PrayerDayCard__cell-name, .PrayerDayCard__cell-time"
      )
    ).toEqual([]);
  });

  test("keeps the place and date in the card, beside the countdown", async ({
    page,
  }) => {
    await expect(page.getByTestId("day-meta-outside")).toHaveCount(0);
    const card = (await page.locator(".PrayerDayCard").boundingBox())!;
    const date = (await page.getByTestId("day-date").boundingBox())!;
    expect(date.y + date.height).toBeLessThanOrEqual(card.y + card.height);
    expect(date.x).toBeGreaterThan(card.x + card.width / 2);
  });

  test("keeps the next seven days in seven columns", async ({ page }) => {
    await waitForNextDays(page);
    await expect(page.locator("[data-layout=normal]")).toHaveCount(1);
    expect(
      await clippedText(page, ".NextDaysCard__name, .NextDaysCard__time")
    ).toEqual([]);
  });

  test("keeps seven columns on a 375pt phone, a little tighter", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await waitForNextDays(page);
    await expect(
      page.locator("[data-layout=normal], [data-layout=compact]")
    ).toHaveCount(1);
    await expect(page.locator("[data-layout=stacked]")).toHaveCount(0);
    expect(await columnsOverlap(page)).toBe(false);
  });

  test("stacks each day 3 x 2 on a 320pt phone, and clips nothing", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(page.locator("[data-layout=stacked]")).toHaveCount(1);
    await waitForNextDays(page);
    expect((await nextDaysRows(page))[0]).toEqual([
      "15",
      ...Object.values(TIMES),
    ]);
    expect(await clippedText(page, NEXT_DAYS_TEXT)).toEqual([]);
    expect(await widerThanPage(page)).toBe(false);
  });

  test("does not make the month table scroll", async ({ page }) => {
    await openMonth(page);
    await expect(
      page.locator(".MonthPrayerTable__scroller--scrolls")
    ).toHaveCount(0);
  });
});

test.describe("at twice the text size", () => {
  test.beforeEach(async ({ page }) => {
    await setTextSize(page, 2);
    await pinDate(page, AFTERNOON);
    await completeSetup(page);
  });

  test("makes the card's text bigger", async ({ page }) => {
    const size = await page
      .locator(".PrayerDayCard__cell-time")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    // 16px at the default size.
    expect(size).toBe(32);
  });

  test("shows every prayer, in two rows of three, without overlaps", async ({
    page,
  }) => {
    expect(await todayTimes(page)).toEqual(TIMES);
    await expect(page.locator(".PrayerDayCard--rows")).toHaveCount(1);

    const card = (await page.locator(".PrayerDayCard").boundingBox())!;
    const boxes = await cellBoxes(page);
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(card.x);
      expect(box.right).toBeLessThanOrEqual(card.x + card.width);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        const overlap =
          a.left < b.right - 1 &&
          b.left < a.right - 1 &&
          a.top < b.bottom - 1 &&
          b.top < a.bottom - 1;
        expect(overlap, `cells ${i} and ${j} overlap`).toBe(false);
      }
    }
    expect(
      await clippedText(
        page,
        ".PrayerDayCard__cell-name, .PrayerDayCard__cell-time"
      )
    ).toEqual([]);
  });

  test("sets the place and date under the card, centred", async ({ page }) => {
    const outside = page.getByTestId("day-meta-outside");
    await expect(outside).toBeVisible();
    await expect(outside).toContainText("London");
    await expect(page.getByTestId("day-date")).toHaveCount(1);

    const card = (await page.locator(".PrayerDayCard").boundingBox())!;
    const line = (await outside.locator("p").first().boundingBox())!;
    expect(line.y).toBeGreaterThanOrEqual(card.y + card.height);
    const middle = line.x + line.width / 2;
    expect(Math.abs(middle - (card.x + card.width / 2))).toBeLessThan(2);
    expect(await clippedText(page, "[data-testid=day-meta-outside] p")).toEqual(
      []
    );
    // What decides it is measured off the screen, and must not widen it.
    const probe = await page
      .locator(".PrayerDayCard__fit-probe")
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(probe).toBe(0);
  });

  test("highlights the next prayer where it is, in the second row", async ({
    page,
  }) => {
    // Asr: first column, second row.
    await expect(
      page.locator("[data-testid=strip-cell][data-next=true]")
    ).toContainText("Asr");
    // Polled: the pane glides into place when the layout changes.
    const offset = () =>
      page.evaluate(() => {
        const pane = document
          .querySelector("[data-testid=highlight-pane]")!
          .getBoundingClientRect();
        const cell = document
          .querySelector("[data-testid=strip-cell][data-next=true]")!
          .getBoundingClientRect();
        return Math.max(
          Math.abs(pane.left - cell.left),
          Math.abs(pane.top - cell.top)
        );
      });
    await expect.poll(offset).toBeLessThan(2);
  });

  test("stacks each day of the next seven, and clips nothing", async ({
    page,
  }) => {
    await expect(page.locator("[data-layout=stacked]")).toHaveCount(1);
    await waitForNextDays(page);
    expect((await nextDaysRows(page))[0]).toEqual([
      "15",
      ...Object.values(TIMES),
    ]);
    expect(await clippedText(page, NEXT_DAYS_TEXT)).toEqual([]);
    expect(await widerThanPage(page)).toBe(false);
    // The Month button grows with the text, and its label is whole.
    const button = (await page.getByTestId("month-button").boundingBox())!;
    expect(button.height).toBeGreaterThanOrEqual(44);
  });

  test("stacks them at 320pt too, without widening the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await waitForNextDays(page);
    await expect(page.locator("[data-layout=stacked]")).toHaveCount(1);
    expect(await clippedText(page, NEXT_DAYS_TEXT)).toEqual([]);
    expect(await widerThanPage(page)).toBe(false);
  });

  test("scrolls the month table sideways rather than breaking its times", async ({
    page,
  }) => {
    await openMonth(page);
    const scroller = page.locator(".MonthPrayerTable__scroller--scrolls");
    await expect(scroller).toHaveCount(1);
    expect(
      await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)
    ).toBe(true);
    expect(await clippedText(page, ".MonthPrayerTable__col")).toEqual([]);
    // One line each: a time broken over two lines read as "06:2" and "6".
    const lines = await page
      .locator(".MonthPrayerTable tbody td")
      .evaluateAll((cells) =>
        cells.map(
          (cell) =>
            cell.getBoundingClientRect().height /
            parseFloat(getComputedStyle(cell).fontSize)
        )
      );
    expect(Math.max(...lines)).toBeLessThan(2);
  });

  test("wraps settings' labels rather than cutting them off", async ({
    page,
  }) => {
    await openSettings(page);
    const cut = await page.evaluate(() => {
      const parts = document.querySelectorAll("ion-toggle, ion-select");
      const clipped: Array<string> = [];
      parts.forEach((host) => {
        host.shadowRoot
          ?.querySelectorAll("[part~=label], [part~=text]")
          .forEach((part) => {
            const el = part as HTMLElement;
            if (el.scrollWidth > el.clientWidth + 1) {
              clipped.push(host.textContent ?? el.textContent ?? "");
            }
          });
      });
      return clipped;
    });
    expect(cut).toEqual([]);
    await expect(
      page.locator("ion-toggle").filter({ hasText: "Prayer Notifications" })
    ).toBeVisible();
  });
});

test("stops growing at twice the default size", async ({ page }) => {
  await setTextSize(page, 3);
  await pinDate(page, AFTERNOON);
  await completeSetup(page);
  const size = await page
    .locator(".PrayerDayCard__cell-time")
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBe(32);
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();
});

test.describe("on a 360px phone at the default size", () => {
  // The commonest Android width (MEL-359). Whether the place and date sit
  // beside the countdown used to depend on the weekday: "Fri" fitted where
  // "Thu" did not, so the card changed layout from one day to the next. It
  // is decided against the widest date now, and these nights have Fajr
  // "11h" away, as wide as the countdown gets, its digits being tabular.
  test.use({ viewport: { width: 360, height: 740 } });

  /** Seven days in a row, and two of the widest months' names. */
  const NIGHTS: Array<[string, string]> = [
    ["2026-01-12T19:00:00Z", "Mon 12 Jan"],
    ["2026-01-13T19:00:00Z", "Tue 13 Jan"],
    ["2026-01-14T19:00:00Z", "Wed 14 Jan"],
    ["2026-01-15T19:00:00Z", "Thu 15 Jan"],
    ["2026-01-16T19:00:00Z", "Fri 16 Jan"],
    ["2026-01-17T19:00:00Z", "Sat 17 Jan"],
    ["2026-01-18T19:00:00Z", "Sun 18 Jan"],
    ["2026-09-23T10:00:00Z", "Wed 23 Sept"],
    ["2026-05-27T10:00:00Z", "Wed 27 May"],
  ];

  async function layoutAt(page: Page, [iso, date]: [string, string]) {
    await page.clock.setFixedTime(new Date(iso));
    await expect(page.getByTestId("day-date")).toHaveText(date);
    await expect(page.getByTestId("countdown")).toContainText("h");
    const outside = (await page.getByTestId("day-meta-outside").count()) > 0;
    // Beside the countdown, the countdown never wraps to make room.
    const countdown = page.getByTestId("countdown");
    const lines = await countdown.evaluate(
      (el) =>
        el.getBoundingClientRect().height /
        parseFloat(getComputedStyle(el).lineHeight || "0")
    );
    return { outside, lines };
  }

  test("lays the card out the same on every day of the week", async ({
    page,
  }) => {
    await pinDate(page, NIGHTS[0][0]);
    await completeSetup(page);
    const layouts = [];
    for (const night of NIGHTS) {
      layouts.push(await layoutAt(page, night));
    }
    expect(new Set(layouts.map((l) => l.outside)).size).toBe(1);
    for (const { lines } of layouts) {
      expect(lines).toBeLessThan(1.5);
    }
  });
});
