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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";

const skillDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(skillDir, "..", "..", "..");
const baseURL = process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:3000";
const evidenceDir = process.env.VERIFY_EVIDENCE_DIR ?? join(skillDir, "evidence");

const command = process.argv[2];
if (command !== "doctor" && command !== "today") {
  console.error("usage: drive.mjs doctor|today");
  process.exit(2);
}

function repoPath(...parts) {
  return join(repoRoot, ...parts);
}

/**
 * London timetable row for a calendar date, formatted the way the app shows it.
 *
 * The JSON stores UTC instants (month, day, fajr, shuruq, duhr, shafi asr,
 * hanafi asr, maghrib, isha). The screen prints those instants in
 * Europe/London, which is the JSON clock time in winter and an hour later
 * during British Summer Time. Shafi asr is the first asr column.
 */
function londonTimes(year, month, day) {
  const file = repoPath("src", "prayer_data", `london-${year}.json`);
  const rows = JSON.parse(readFileSync(file, "utf8"));
  const row = rows.find(
    (entry) => Number(entry[0]) === month && Number(entry[1]) === day
  );
  if (!row) {
    throw new Error(`london-${year}.json has no row for ${month}/${day}`);
  }
  const asLondon = (hhmm) => {
    const [hours, minutes] = hhmm.split(":").map(Number);
    const instant = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
    }).format(instant);
  };
  const utc = {
    Fajr: row[2],
    Shuruq: row[3],
    Duhr: row[4],
    Asr: row[5],
    Maghrib: row[7],
    Isha: row[8],
  };
  return {
    utc,
    expected: Object.fromEntries(
      Object.entries(utc).map(([name, hhmm]) => [name, asLondon(hhmm)])
    ),
  };
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

async function londonNow(page) {
  return page.evaluate(() => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const parts = formatter.formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type).value;
    const monthNumber = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        month: "numeric",
      }).format(new Date())
    );
    return {
      year: Number(get("year")),
      month: monthNumber,
      day: Number(get("day")),
      // Same shape as formatDateInZone: en-GB short date with the comma removed.
      label: `${get("weekday")} ${get("day")} ${get("month")}`,
    };
  });
}

async function readStrip(page) {
  return page.locator("[data-testid=prayer-strip]").evaluate((strip) => {
    const times = {};
    for (const cell of strip.querySelectorAll("[data-testid=strip-cell]")) {
      const [name, time] = cell.querySelectorAll("span");
      times[name.textContent.trim()] = time.textContent.trim();
    }
    return times;
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

    const when = await londonNow(page);
    const { utc, expected } = londonTimes(when.year, when.month, when.day);
    const times = await readStrip(page);
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

    const names = ["Fajr", "Shuruq", "Duhr", "Asr", "Maghrib", "Isha"];
    const mismatches = names.filter((name) => times[name] !== expected[name]);
    const countdownOk = /^\d/.test(countdown);
    const storedOk = storedSettings?.location === "london";

    await page.screenshot({ path: join(evidenceDir, "today-home.png") });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-testid=prayer-strip]").waitFor({ state: "visible" });
    const afterReload = await readStrip(page);
    const doneAfterReload = await page.getByRole("button", { name: "Done" }).count();
    const reloadOk =
      doneAfterReload === 0 &&
      names.every((name) => afterReload[name] === expected[name]);

    const report = {
      ok:
        mismatches.length === 0 &&
        dayDate === when.label &&
        countdownOk &&
        names.includes(highlighted) &&
        storedOk &&
        reloadOk,
      baseURL,
      londonDate: when,
      dayDate,
      timetableUtc: utc,
      expected,
      times,
      mismatches,
      countdown,
      highlighted,
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
const probe = spawnSync("curl", ["-sf", "-o", "/dev/null", "-w", "%{http_code}", `${baseURL}/`], {
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
