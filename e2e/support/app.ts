import { expect, type Page } from "@playwright/test";

/**
 * Shared driving of the app for the e2e specs.
 *
 * Everything here is about getting the app into a state, or reading what it is
 * showing. Assertions belong in the specs, with two exceptions: these helpers
 * wait for the screen they navigated to, because a helper that returns before
 * the app has arrived produces failures that point at the wrong line.
 */

/** The picker on setup and settings; also a reliable "app has loaded" marker. */
export const LOCATION_SELECT = "[data-testid=location-select]";

/** The row of six times on the home screen; the marker that it has arrived. */
export const PRAYER_STRIP = "[data-testid=prayer-strip]";

/**
 * Freezes the clock before the app boots.
 *
 * Times on screen come from a fixed timetable, so pinning the date is what
 * makes them assertable at all - otherwise every expectation would go stale
 * tomorrow. Must be called before the first goto.
 */
export async function pinDate(page: Page, iso: string) {
  await page.clock.setFixedTime(new Date(iso));
}

/** Loads the app at the setup screen. */
export async function openSetup(page: Page) {
  await page.goto("/");
  await page.waitForSelector(LOCATION_SELECT);
}

/** Loads the app and completes setup, landing on the home screen. */
export async function completeSetup(page: Page) {
  await openSetup(page);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Done" })).toHaveCount(0);
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();
}

export async function openSettings(page: Page) {
  await page.locator("ion-button[router-link='/settings']").click();
  await expect(page.locator(LOCATION_SELECT)).toBeVisible();
}

export async function goHome(page: Page) {
  await page.locator("ion-button[router-link='/']").click();
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();
}

/**
 * Picks an option from one of the list's selects, tapping the row well away
 * from the control.
 *
 * Tapping the row rather than the control on purpose: Ionic 8 dropped the
 * sibling-label association that used to make the whole row work, and this app
 * has shipped that regression twice. Locator.tap rather than raw coordinates
 * so it waits out any page transition instead of aiming at a stale box.
 */
export async function chooseFromSelect(
  page: Page,
  selector: string,
  option: string
) {
  const row = page.locator("ion-item").filter({ has: page.locator(selector) });
  const box = (await row.boundingBox())!;
  await row.tap({ position: { x: box.width - 20, y: box.height / 2 } });

  const alert = page.locator("ion-alert");
  await expect(alert).toBeVisible();
  await alert.getByRole("radio", { name: option, exact: true }).click();
  await alert.getByRole("button", { name: "Choose" }).click();
  await expect(alert).toBeHidden();
}

/** Flips one of the list's toggles by its label. */
export async function toggle(page: Page, label: string) {
  await page.locator("ion-toggle").filter({ hasText: label }).click();
}

/** The day strip, as a { Fajr: "05:36", ... } map. */
export async function todayTimes(page: Page): Promise<Record<string, string>> {
  await expect(page.locator(PRAYER_STRIP)).toBeVisible();
  return page.locator(PRAYER_STRIP).evaluate((strip) => {
    const times: Record<string, string> = {};
    for (const cell of strip.querySelectorAll("[data-testid=strip-cell]")) {
      const [name, time] = cell.querySelectorAll("span");
      times[name.textContent!.trim()] = time.textContent!.trim();
    }
    return times;
  });
}

/** The prayer the strip is highlighting, e.g. "Duhr". */
export async function highlightedPrayer(page: Page): Promise<string> {
  return page
    .locator("[data-testid=strip-cell][data-next=true]")
    .locator("span")
    .first()
    .innerText();
}

/**
 * Where the card's tail is pointing, read off the screen rather than out of the
 * markup.
 *
 * `painted` asks the page what is actually drawn in the gap below the card,
 * because a tail that has been clipped away keeps its box and its position -
 * ion-card's paint containment swallowed it whole the first time round, and
 * nothing about the DOM said so. `column` is the strip cell the tip lands in.
 */
export async function tailTarget(
  page: Page
): Promise<{ painted: boolean; column: string | null }> {
  return page.evaluate(() => {
    const tail = document.querySelector(".PrayerDayCard__tail")!;
    const bubble = document.querySelector(".PrayerDayCard__bubble")!;
    const box = tail.getBoundingClientRect();
    const x = box.x + box.width / 2;
    const y = bubble.getBoundingClientRect().bottom + 2;

    let column: string | null = null;
    for (const cell of document.querySelectorAll("[data-testid=strip-cell]")) {
      const rect = cell.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right) {
        column = cell.querySelector("span")!.textContent!.trim();
      }
    }

    return { painted: document.elementFromPoint(x, y) === tail, column };
  });
}

/** The month table's rows, each as [day, ...six times]. */
export async function monthRows(page: Page): Promise<Array<Array<string>>> {
  return page.locator(".MonthPrayerTable tbody").evaluate((body) =>
    Array.from(body.querySelectorAll("tr")).map((row) =>
      Array.from(row.querySelectorAll("td")).map((cell) =>
        cell.textContent!.trim()
      )
    )
  );
}

/**
 * Waits for the month table to hold real times rather than the loading
 * skeleton, which renders a fixed 30 empty rows.
 */
export async function waitForMonthTable(page: Page) {
  await expect
    .poll(async () => (await monthRows(page))[0]?.[1] ?? "")
    .toMatch(/^\d{2}:\d{2}$/);
}

/** The day numbers of any highlighted (today) rows in the month table. */
export async function highlightedDays(page: Page): Promise<Array<string>> {
  return page
    .locator(".MonthPrayerTable__row--selected")
    .evaluateAll((rows) =>
      rows.map((row) => row.querySelector("td")!.textContent!.trim())
    );
}
