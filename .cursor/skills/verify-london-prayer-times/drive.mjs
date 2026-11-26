#!/usr/bin/env node
/**
 * Read-only doctor, and the one drive this skill proves: today's prayer times.
 *
 *   node .cursor/skills/verify-london-prayer-times/drive.mjs doctor
 *   node .cursor/skills/verify-london-prayer-times/drive.mjs today
 *
 * VERIFY_BASE_URL      default http://127.0.0.1:3000
 * VERIFY_EVIDENCE_DIR  default <this directory>/evidence
 * CHROMIUM_PATH        optional Chromium/Chrome executable
 *
 * Uses @playwright/test, already a devDependency. Does not install anything.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";
import { PRAYER_NAMES, stripDay } from "./timetable.mjs";

const skillDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(skillDir, "..", "..", "..");
const baseURL = process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:3000";
const evidenceDir = process.env.VERIFY_EVIDENCE_DIR ?? join(skillDir, "evidence");

const command = process.argv[2];
if (command !== "doctor" && command !== "today") {
  console.error("usage: drive.mjs doctor|today");
  process.exit(2);
}

async function launch() {
  const executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    timezoneId: "Europe/London",
    locale: "en-GB",
    colorScheme: "light",
    baseURL,
  });
  const page = await context.newPage();
  return { browser, context, page };
}

async function waitForScreen(page) {
  const handle = await page.waitForSelector(
    "[data-testid=location-select], [data-testid=prayer-strip]",
    { timeout: 20_000 }
  );
  const testId = await handle.getAttribute("data-testid");
  return testId === "prayer-strip" ? "home" : "setup";
}

async function readStrip(page) {
  return page.locator("[data-testid=prayer-strip]").evaluate((strip) => {
    const times = {};
    const order = [];
    for (const cell of strip.querySelectorAll("[data-testid=strip-cell]")) {
      const [name, time] = cell.querySelectorAll("span");
      order.push(name.textContent.trim());
      times[name.textContent.trim()] = time.textContent.trim();
    }
    // The map alone cannot see a strip in the wrong order, so keep the DOM
    // order as well.
    return { order, times };
  });
}

/**
 * The next prayer's highlight, read off the screen rather than out of the
 * markup: the highlighted cell must lie inside the card and be what is drawn
 * at its own centre. Returns its prayer's name, or null. Same test as
 * `paintedHighlight` in e2e/support/app.ts.
 */
async function paintedHighlight(page) {
  return page.evaluate(() => {
    const cell = document.querySelector("[data-testid=strip-cell][data-next=true]");
    const card = document.querySelector(".PrayerDayCard");
    if (!cell || !card) return null;
    const box = cell.getBoundingClientRect();
    const outer = card.getBoundingClientRect();
    const inside =
      box.left >= outer.left &&
      box.right <= outer.right &&
      box.top >= outer.top &&
      box.bottom <= outer.bottom;
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2
    );
    return inside && hit && cell.contains(hit)
      ? cell.querySelector("span").textContent.trim()
      : null;
  });
}

function writeJson(name, value) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

async function doctor() {
  const { browser, page } = await launch();
  try {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    const status = response?.status() ?? 0;
    const screen = await waitForScreen(page);
    const report = {
      ok: status === 200 && (screen === "setup" || screen === "home"),
      baseURL,
      status,
      screen,
      title: await page.title(),
    };
    console.log(JSON.stringify(report));
    if (!report.ok) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

async function today() {
  mkdirSync(evidenceDir, { recursive: true });
  const { browser, page } = await launch();
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const screen = await waitForScreen(page);
    if (screen !== "setup") {
      throw new Error(
        `expected a fresh context to show setup (location-select), saw ${screen}. Storage was not empty.`
      );
    }

    await page.screenshot({ path: join(evidenceDir, "today-setup.png") });
    await page.getByRole("button", { name: "Done" }).click();
    await page.locator("[data-testid=prayer-strip]").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Done" }).waitFor({ state: "detached" });

    // saveSettings debounces the localStorage write by 500ms. The screen
    // updates immediately; the side effect we check does not.
    await page.waitForTimeout(700);

    // The page's clock is this machine's clock; nothing here pins it. After
    // Isha the strip, and the date on the card, are tomorrow's.
    const shown = stripDay(repoRoot, "london");
    const when = shown.date;
    const { utc, expected } = shown.times;
    const { order, times } = await readStrip(page);
    const painted = await paintedHighlight(page);
    const cardMeta = (await page.locator(".PrayerDayCard__meta").innerText()).trim();
    const countdownLine = (
      // The head, not just the countdown: "Duhr was 12m ago" is its own line
      // under the whole top row (PrayerDayCard__since).
      await page.locator(".PrayerDayCard__head").innerText()
    ).trim();
    const tomorrowBadge = await page.getByTestId("tomorrow-badge").count();
    const dayDate = (await page.getByTestId("day-date").innerText()).trim();
    const countdown = (await page.getByTestId("countdown").innerText()).trim();
    const highlighted = (
      await page
        .locator("[data-testid=strip-cell][data-next=true] span")
        .first()
        .innerText()
    ).trim();
    const stored = await page.evaluate(() =>
      localStorage.getItem("CapacitorStorage.settings")
    );
    const storedSettings = stored ? JSON.parse(stored) : null;

    const names = PRAYER_NAMES;
    const mismatches = names.filter((name) => times[name] !== expected[name]);
    const countdownOk = /^\d/.test(countdown);
    const storedOk = storedSettings?.location === "london";
    const orderOk = order.join(",") === names.join(",");
    // The card names the location and the previous prayer ("Duhr was 12m ago").
    const cardLocationOk = /\bLondon\b/.test(cardMeta);
    const previousPrayerOk = /\bwas\b.+\bago\b/.test(countdownLine);
    // The highlight must be painted, inside the card.
    const highlightOk = painted === highlighted;

    await page.screenshot({ path: join(evidenceDir, "today-home.png") });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-testid=prayer-strip]").waitFor({ state: "visible" });
    const afterReload = (await readStrip(page)).times;
    const doneAfterReload = await page.getByRole("button", { name: "Done" }).count();
    const reloadOk =
      doneAfterReload === 0 &&
      names.every((name) => afterReload[name] === expected[name]);

    const report = {
      ok:
        mismatches.length === 0 &&
        dayDate === when.label &&
        tomorrowBadge === (shown.rolled ? 1 : 0) &&
        countdownOk &&
        names.includes(highlighted) &&
        orderOk &&
        cardLocationOk &&
        previousPrayerOk &&
        highlightOk &&
        storedOk &&
        reloadOk,
      baseURL,
      londonDate: when,
      rolledToTomorrow: shown.rolled,
      tomorrowBadge: tomorrowBadge === 1,
      dayDate,
      timetableUtc: utc,
      expected,
      times,
      stripOrder: order,
      mismatches,
      countdown,
      highlighted,
      cardMeta,
      countdownLine,
      paintedHighlight: painted,
      storedLocation: storedSettings?.location ?? null,
      reloadOk,
    };
    writeJson("today.json", report);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

// Playwright's clock and the dev server are independent. Fail fast when the
// port is closed so the error is the server, not a 20s selector timeout.
const probe = spawnSync("curl", ["-sf", "-o", "/dev/null", `${baseURL}/`], {
  encoding: "utf8",
});
if (probe.status !== 0) {
  console.error(`nothing usable at ${baseURL} (curl exit ${probe.status}). Start the dev server first.`);
  process.exit(1);
}

if (command === "doctor") {
  await doctor();
} else {
  await today();
}
