import { test, expect, type Page } from "@playwright/test";

// The whole app re-renders once a second off the countdown ticker, and
// @ionic/react re-assigns every prop to the underlying element on every one of
// those renders. A range mid-drag therefore had its value overwritten with the
// last committed one about once a second, snapping the knob back to where the
// drag started before the next touch move caught it up again.
//
// Reproducing it needs a drag that outlasts a tick and is sampled while it
// happens, which is a real-browser job. Before the fix this recorded
// "5, 3, 5, 7, 5, 10, 12, ..." on a single left-to-right drag.

test.use({ permissions: ["notifications"] });

/** Completes setup, then turns reminders on from the settings screen. */
async function openReminderSlider(page: Page) {
  await page.goto("/");
  await page.waitForSelector("[data-testid=location-select]");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Done" })).toHaveCount(0);

  await page.locator("ion-button[router-link='/settings']").click();
  await page
    .locator("ion-toggle")
    .filter({ hasText: "Notify before prayer" })
    .click();
  await expect(page.locator(".settings-list__range-label")).toBeVisible();
}

const rangeValue = (page: Page) =>
  page
    .locator("ion-range")
    .evaluate((el) => (el as unknown as { value: number }).value);

/**
 * A touch drag. page.mouse does not move the knob at all on an emulated phone
 * - Ionic's gestures follow touch there - and page.touchscreen only taps, so
 * the moves go through CDP. One session for the whole gesture: a fresh one
 * does not know a touch is already down.
 */
async function touchDriver(page: Page) {
  const session = await page.context().newCDPSession(page);
  return (
    type: "touchStart" | "touchMove" | "touchEnd",
    x: number,
    y: number
  ) =>
    session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });
}

/**
 * Drags the knob to the right end, reading the value after each move.
 *
 * Starts on the knob rather than at the left edge: grabbing the bar elsewhere
 * makes the knob jump to meet the finger, which is correct behaviour but looks
 * exactly like the regression this is watching for. `onEachStep` runs while a
 * finger is still down.
 */
async function dragRightAndSample(
  page: Page,
  steps: number,
  onEachStep?: () => Promise<void>
) {
  const touch = await touchDriver(page);
  const knob = (await page
    .locator("ion-range .range-knob-handle")
    .boundingBox())!;
  const track = (await page.locator("ion-range").boundingBox())!;
  const y = knob.y + knob.height / 2;
  const from = knob.x + knob.width / 2;
  const to = track.x + track.width - 12;

  await touch("touchStart", from, y);

  const samples: Array<number> = [];
  for (let i = 1; i <= steps; i++) {
    await touch("touchMove", from + ((to - from) * i) / steps, y);
    // Long enough that the once-a-second re-render lands inside the drag.
    await page.waitForTimeout(150);
    samples.push(await rangeValue(page));
    await onEachStep?.();
  }
  await touch("touchEnd", to, y);
  return samples;
}

test("keeps the knob under the finger while dragging", async ({ page }) => {
  await openReminderSlider(page);
  const samples = await dragRightAndSample(page, 12);

  // Dragging one way should only ever move the value that way. A dip means a
  // re-render clobbered the in-flight value.
  const dips = samples.filter((value, i) => i > 0 && value < samples[i - 1]);
  expect(
    dips,
    `values went backwards during a left-to-right drag: ${samples.join(", ")}`
  ).toEqual([]);

  expect(samples[samples.length - 1]).toBeGreaterThan(samples[0]);
});

test("tracks the drag in the label, not just on release", async ({ page }) => {
  await openReminderSlider(page);
  const label = page.locator(".settings-list__range-label");
  await expect(label).toHaveText("Notify 5 minutes before prayer");

  const readings: Array<string> = [];
  await dragRightAndSample(page, 6, async () => {
    readings.push(await label.innerText());
  });

  // Every reading was taken with a finger still down, so the label was
  // following the drag rather than waiting for release.
  expect(new Set(readings).size).toBeGreaterThan(1);
  await expect(label).toHaveText(readings[readings.length - 1]);
});

test("commits the value it finished on", async ({ page }) => {
  await openReminderSlider(page);
  await dragRightAndSample(page, 6);

  const settled = await rangeValue(page);
  expect(settled).toBeGreaterThan(5);

  // Survives a reload, so it reached storage rather than only the knob.
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator(".settings-list__range-label")).toBeVisible();
  await expect.poll(() => rangeValue(page)).toBe(settled);
});
