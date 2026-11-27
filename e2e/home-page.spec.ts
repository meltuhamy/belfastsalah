import { test, expect, Page } from "@playwright/test";
import {
  PRAYER_STRIP,
  completeSetup,
  highlightedDays,
  highlightedPrayer,
  monthRows,
  nextDaysRows,
  openMonth,
  pinDate,
  paintedHighlight,
  todayTimes,
  waitForNextDays,
} from "./support/app";

// The home screen is the app. Everything here is asserted against the real
// timetable in src/prayer_data rather than against whatever the app happens to
// render, so a change to the lookup shows up as a wrong number.
//
// 15 February 2026 is deliberately in winter: the UK is on GMT, so the times
// on screen are the timetable's own strings and the expectations below can be
// read straight out of london-2026.json.

const NOON_ISH = "2026-02-15T10:00:00Z";

const LONDON_15_FEB = {
  Fajr: "05:35",
  Shuruq: "07:12",
  Duhr: "12:20",
  Asr: "14:46",
  Maghrib: "17:19",
  Isha: "18:49",
};

test.beforeEach(async ({ page }) => {
  await pinDate(page, NOON_ISH);
  await completeSetup(page);
});

test("lists today's six prayers, as printed on the timetable", async ({
  page,
}) => {
  expect(await todayTimes(page)).toEqual(LONDON_15_FEB);
});

test("dates the card in the timetable's calendar", async ({ page }) => {
  await expect(page.getByTestId("day-date")).toHaveText("Sun 15 Feb");
});

test("names the next prayer and counts down to it", async ({ page }) => {
  // 10:00, so Duhr at 12:20 is next and Shuruq at 07:12 has been and gone.
  await expect(page.getByText("Duhr in")).toBeVisible();
  await expect(page.getByTestId("countdown")).toHaveText("2h 20m");
  await expect(page.getByText("Shuruq was 2h 48m ago")).toBeVisible();
});

test("highlights the prayer it is counting down to", async ({ page }) => {
  expect(await highlightedPrayer(page)).toBe("Duhr");
  await expect.poll(() => paintedHighlight(page)).toBe("Duhr");
});

test("highlights the columns on either end inside the card", async ({
  page,
}) => {
  // The two cells closest to the card's rounded corners.
  // Walked forwards, because that is the only direction the app expects the
  // clock to move: it refetches when a prayer passes, not when one un-passes.
  await page.clock.setFixedTime(new Date("2026-02-15T18:00:00Z"));
  await expect.poll(() => highlightedPrayer(page)).toBe("Isha");
  await expect.poll(() => paintedHighlight(page)).toBe("Isha");

  await page.clock.setFixedTime(new Date("2026-02-16T03:00:00Z"));
  await expect.poll(() => highlightedPrayer(page)).toBe("Fajr");
  await expect.poll(() => paintedHighlight(page)).toBe("Fajr");
});

test("fills a dot on the timeline for each prayer that has passed", async ({
  page,
}) => {
  const dots = page.locator(
    "[data-testid=timeline] .PrayerDayCard__dot[data-shown=true]"
  );
  // 10:00: Fajr and Shuruq are behind us, Duhr at 12:20 is not.
  await expect(dots).toHaveCount(6);
  await expect
    .poll(() => dots.evaluateAll((all) => all.map((d) => d.dataset.passed)))
    .toEqual(["true", "true", "false", "false", "false", "false"]);

  // Fajr and Shuruq, done, and Duhr, next, are at full strength; only the
  // prayers after the next one are faded back.
  await expect
    .poll(() =>
      dots.evaluateAll((all) => all.map((d) => getComputedStyle(d).opacity))
    )
    .toEqual(["1", "1", "1", "0.55", "0.55", "0.55"]);

  // After Isha the strip has slid along to tomorrow's Fajr: Shuruq to Isha
  // have come in, Fajr has not, and the evening's line runs on towards it.
  await page.clock.setFixedTime(new Date("2026-02-15T20:00:00Z"));
  await expect
    .poll(() => dots.evaluateAll((all) => all.map((d) => d.dataset.passed)))
    .toEqual(["true", "true", "true", "true", "true", "false"]);
  await expect(page.locator(".PrayerDayCard__timeline-fill")).toHaveCount(1);
});

test("runs the evening's line off the card's left edge overnight", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-02-15T20:00:00Z"));
  await expect.poll(() => highlightedPrayer(page)).toBe("Fajr");
  // Today's Fajr has slid off to the left, so the line from it starts beyond
  // the card, and is clipped at the card's own edge, not the strip's.
  const card = (await page.locator(".PrayerDayCard").boundingBox())!;
  const clip = (await page.getByTestId("timeline").boundingBox())!;
  const line = (await page
    .locator(".PrayerDayCard__timeline-fill")
    .boundingBox())!;
  expect(line.x).toBeLessThan(card.x);
  expect(clip.x).toBeCloseTo(card.x, 0);
  expect(clip.x + clip.width).toBeCloseTo(card.x + card.width, 0);
});

test("pulses a prayer's dot while its adhan is called", async ({ page }) => {
  const recent = () =>
    page
      .locator("[data-testid=timeline] .PrayerDayCard__dot")
      .evaluateAll((all) => all.map((d) => d.dataset.recent));

  // Duhr came in at 12:20.
  await page.clock.setFixedTime(new Date("2026-02-15T12:23:00Z"));
  await expect
    .poll(recent)
    .toEqual(["false", "false", "true", "false", "false", "false"]);

  await page.clock.setFixedTime(new Date("2026-02-15T12:26:00Z"));
  await expect
    .poll(recent)
    .toEqual(["false", "false", "false", "false", "false", "false"]);
});

test("rolls the countdown onto the next prayer once one passes", async ({
  page,
}) => {
  await expect(page.getByText("Duhr in")).toBeVisible();

  // Straight past Duhr. The card should move on rather than count backwards.
  await page.clock.setFixedTime(new Date("2026-02-15T12:30:00Z"));
  await expect(page.getByText("Asr in")).toBeVisible();
  await expect(page.getByText("Duhr was 10m ago")).toBeVisible();
  await expect.poll(() => highlightedPrayer(page)).toBe("Asr");
  await expect.poll(() => paintedHighlight(page)).toBe("Asr");
});

test("says it's time for a prayer while its adhan is called, then moves on", async ({
  page,
}) => {
  // 15 February: Asr 14:46, Maghrib 17:19. At the very second Asr comes in,
  // the card used to go blank until the app had found the next prayer.
  await page.clock.setFixedTime(new Date("2026-02-15T14:46:00Z"));
  const now = page.getByTestId("adhan-now");
  await expect(now).toContainText("It's time for");
  await expect(page.getByTestId("countdown")).toHaveText("Asr");
  await expect(page.getByText("Maghrib is in 2h 33m")).toBeVisible();
  await expect(now.getByTestId("adhan-icon")).toBeVisible();
  await expect.poll(() => highlightedPrayer(page)).toBe("Asr");

  // Still Asr four minutes on.
  await page.clock.setFixedTime(new Date("2026-02-15T14:50:00Z"));
  await expect(page.getByTestId("countdown")).toHaveText("Asr");

  // Five minutes on, the card counts down to Maghrib and the highlight moves.
  await page.clock.setFixedTime(new Date("2026-02-15T14:51:00Z"));
  await expect(page.getByText("Maghrib in")).toBeVisible();
  await expect(page.getByTestId("adhan-now")).toHaveCount(0);
  await expect.poll(() => highlightedPrayer(page)).toBe("Maghrib");
  await expect.poll(() => paintedHighlight(page)).toBe("Maghrib");
});

test("counts the last second down rather than going blank", async ({
  page,
}) => {
  // Half a second before Asr (14:46). Rounded down, that was "0s", which
  // printed nothing, so the card said only "Asr in" until Asr came.
  await page.clock.setFixedTime(new Date("2026-02-15T14:45:59.500Z"));
  await expect(page.getByText("Asr in")).toBeVisible();
  await expect(page.getByTestId("countdown")).toHaveText("1s");

  // Then straight to the adhan, the old headline leaving as the new arrives.
  await page.clock.setFixedTime(new Date("2026-02-15T14:46:00Z"));
  await expect(page.getByTestId("countdown")).toHaveText("Asr");
  await expect(page.getByTestId("headline-leaving")).toContainText("Asr in");
  await expect(page.getByTestId("headline-leaving")).toHaveCount(0);
});

test('keeps the space before "ago" when the time since drops to seconds', async ({
  page,
}) => {
  // The next morning: Fajr 05:33, Shuruq 07:10 on 16 February. Going from
  // minutes to "30s ago", Chrome dropped the space it had collapsed into the
  // minutes' trailing one: the card read "Shuruq was 30sago". Only what is
  // drawn shows it - the DOM's text still had the space - so this reads
  // innerText.
  await page.clock.setFixedTime(new Date("2026-02-16T07:05:00Z"));
  const since = page.locator(".PrayerDayCard__since");
  await expect
    .poll(() => since.evaluate((el) => (el as HTMLElement).innerText))
    .toBe("Fajr was 1h 32m ago");
  await page.clock.setFixedTime(new Date("2026-02-16T07:10:30Z"));
  await expect
    .poll(() => since.evaluate((el) => (el as HTMLElement).innerText))
    .toBe("Shuruq was 30s ago");
});

test("never calls Shuruq a prayer time", async ({ page }) => {
  // Shuruq 07:12 on 15 February: sunrise, with no adhan.
  await page.clock.setFixedTime(new Date("2026-02-15T07:13:00Z"));
  await expect(page.getByText("Duhr in")).toBeVisible();
  await expect(page.getByTestId("adhan-now")).toHaveCount(0);
});

// The 15th's evening into the 16th: Shuruq to Isha, then the 16th's Fajr.
const LONDON_15_FEB_NIGHT = {
  Shuruq: LONDON_15_FEB.Shuruq,
  Duhr: LONDON_15_FEB.Duhr,
  Asr: LONDON_15_FEB.Asr,
  Maghrib: LONDON_15_FEB.Maghrib,
  Isha: LONDON_15_FEB.Isha,
  Fajr: "05:33",
};

test("keeps today's strip through Isha's adhan moment", async ({ page }) => {
  // Isha comes in at 18:49 on the 15th.
  await page.clock.setFixedTime(new Date("2026-02-15T18:52:00Z"));
  await expect(page.getByTestId("adhan-now")).toBeVisible();
  await expect.poll(() => todayTimes(page)).toEqual(LONDON_15_FEB);
  await expect.poll(() => paintedHighlight(page)).toBe("Isha");
});

test("slides tomorrow's Fajr in once Isha's moment is over", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-02-15T18:55:00Z"));
  // Today's Shuruq to Isha moved over, and 16 Feb's own Fajr on the right.
  await expect.poll(() => todayTimes(page)).toEqual(LONDON_15_FEB_NIGHT);
  await expect.poll(() => highlightedPrayer(page)).toBe("Fajr");
  await expect.poll(() => paintedHighlight(page)).toBe("Fajr");
  // Still the 15th for the reader, and no badge to say otherwise.
  await expect(page.getByTestId("day-date")).toHaveText("Sun 15 Feb");
  await expect(page.getByText("Tomorrow")).toHaveCount(0);
});

/** Counts the strip's slides, from now on in the page it is run in. */
function listenForSlides() {
  const seen: string[] = [];
  (window as unknown as { slides: string[] }).slides = seen;
  document.addEventListener(
    "transitionrun",
    (event) => {
      const target = event.target as Element;
      if (target.classList.contains("PrayerDayCard__row")) {
        seen.push(event.propertyName);
      }
    },
    true
  );
}

async function slides(page: Page): Promise<string[]> {
  // Long enough for a slide to have started.
  await page.waitForTimeout(500);
  return page.evaluate(
    () => (window as unknown as { slides: string[] }).slides
  );
}

// The strip slides when Isha's moment ends in front of the reader, not when
// the app catches up with a night it was not open for. It used to: until the
// next prayer had loaded the phase read as the day, so the day's strip was
// drawn and then slid over to the night's.
test("opens on the night's strip without sliding to it", async ({ page }) => {
  await page.addInitScript(listenForSlides);
  await page.clock.setFixedTime(new Date("2026-02-15T20:00:00Z"));
  await page.evaluate(() => localStorage.clear());
  await completeSetup(page);
  await expect.poll(() => todayTimes(page)).toEqual(LONDON_15_FEB_NIGHT);
  await expect.poll(() => paintedHighlight(page)).toBe("Fajr");
  expect(await slides(page)).toEqual([]);
});

test("comes back to the night's strip without sliding to it", async ({
  page,
}) => {
  await page.evaluate(listenForSlides);
  // Away from 10:00 until 20:00, as a phone in a pocket is.
  await page.clock.setFixedTime(new Date("2026-02-15T20:00:00Z"));
  await expect.poll(() => todayTimes(page)).toEqual(LONDON_15_FEB_NIGHT);
  await expect.poll(() => paintedHighlight(page)).toBe("Fajr");
  expect(await slides(page)).toEqual([]);
});

test("holds the night's strip past midnight, and dates it the new day", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-02-16T00:30:00Z"));
  await expect(page.getByTestId("day-date")).toHaveText("Mon 16 Feb");
  await expect.poll(() => todayTimes(page)).toEqual(LONDON_15_FEB_NIGHT);
  await expect.poll(() => paintedHighlight(page)).toBe("Fajr");
});

test("slides back to the start of the day as Fajr comes in", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-02-16T03:00:00Z"));
  await expect.poll(() => todayTimes(page)).toEqual(LONDON_15_FEB_NIGHT);

  // 16 Feb: Fajr 05:33.
  await page.clock.setFixedTime(new Date("2026-02-16T05:34:00Z"));
  await expect(page.getByTestId("countdown")).toHaveText("Fajr");
  await expect.poll(async () => (await todayTimes(page)).Fajr).toBe("05:33");
  await expect
    .poll(async () => Object.keys(await todayTimes(page)))
    .toEqual(["Fajr", "Shuruq", "Duhr", "Asr", "Maghrib", "Isha"]);
  await expect.poll(() => paintedHighlight(page)).toBe("Fajr");

  // And once Fajr's moment is over, the same six, Shuruq next.
  await page.clock.setFixedTime(new Date("2026-02-16T05:40:00Z"));
  await expect.poll(() => paintedHighlight(page)).toBe("Shuruq");
  await expect.poll(async () => (await todayTimes(page)).Fajr).toBe("05:33");
});

test("keeps the toolbar flat until something is under it", async ({ page }) => {
  // Short enough that the page scrolls at all.
  await page.setViewportSize({ width: 412, height: 560 });
  await page.mouse.move(200, 300);
  const shadow = () =>
    page.locator("ion-header").evaluate((h) => getComputedStyle(h).boxShadow);

  // The shadow is there to separate the toolbar from content passing beneath
  // it, so at rest it has nothing to separate.
  expect(await shadow()).toBe("none");

  await page.mouse.wheel(0, 400);
  await expect.poll(shadow).not.toBe("none");

  await page.mouse.wheel(0, -800);
  await expect.poll(shadow).toBe("none");
});

test("lists the next seven days, today first", async ({ page }) => {
  await waitForNextDays(page);
  // london-2026.json, 15 to 21 February.
  expect(await nextDaysRows(page)).toEqual([
    ["15", "05:35", "07:12", "12:20", "14:46", "17:19", "18:49"],
    ["16", "05:33", "07:10", "12:20", "14:47", "17:21", "18:51"],
    ["17", "05:31", "07:08", "12:20", "14:49", "17:22", "18:51"],
    ["18", "05:29", "07:06", "12:20", "14:50", "17:24", "18:53"],
    ["19", "05:27", "07:04", "12:19", "14:51", "17:26", "18:55"],
    ["20", "05:25", "07:02", "12:19", "14:53", "17:28", "18:57"],
    ["21", "05:23", "07:00", "12:19", "14:54", "17:30", "18:58"],
  ]);
});

test("marks today's row, and only today's", async ({ page }) => {
  const today = page.locator("[data-testid=next-day][data-today=true]");
  await expect(today).toHaveCount(1);
  await expect(today).toHaveAttribute("data-day", "15");
  await expect(today).toContainText("Today");
});

test("agrees with the today card row for row", async ({ page }) => {
  await waitForNextDays(page);
  const [, ...todayRow] = (await nextDaysRows(page))[0];
  expect(todayRow).toEqual(Object.values(LONDON_15_FEB));
});

test("opens the whole month from the Month button", async ({ page }) => {
  // At least 44 tall: the old calendar icon was an 18px target (MEL-363).
  const button = (await page.getByTestId("month-button").boundingBox())!;
  expect(button.height).toBeGreaterThanOrEqual(44);

  await openMonth(page);
  await expect(page.getByTestId("month-title")).toHaveText("February 2026");
  const rows = await monthRows(page);
  // February 2026 has 28 days. The timetable file carries a 29th - every
  // non-leap year in src/prayer_data does, duplicating the 28th - so this is
  // also a check that the table follows the calendar and not the file.
  expect(rows).toHaveLength(28);
  expect(rows[0]).toEqual([
    "1",
    "05:59",
    "07:36",
    "12:19",
    "14:26",
    "16:53",
    "18:29",
  ]);
  expect(rows[27]).toEqual([
    "28",
    "05:08",
    "06:45",
    "12:18",
    "15:03",
    "17:42",
    "19:09",
  ]);
  expect(await highlightedDays(page)).toEqual(["15"]);
});

test("puts the settings screen one tap away and comes back", async ({
  page,
}) => {
  await page.locator("ion-button[router-link='/settings']").click();
  await expect(
    page.locator("ion-title", { hasText: "Settings" })
  ).toBeVisible();
  await page.locator("ion-button[router-link='/']").click();
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();
});

// Icon-only, so without a label a screen reader announces nothing useful.
// Links rather than buttons: an ion-button with a routerLink renders an <a>. The
// iOS preview capture also finds them by these names.
test("names the settings and home links", async ({ page }) => {
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();
});

