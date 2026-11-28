#!/usr/bin/env node
/**
 * Captures the day card through a whole day, for reviewing a change to how
 * the sky looks (MEL-376). For one place and date it writes:
 *
 *   day.mp4                  the whole day, midnight to midnight, in a minute
 *   <n>-<prayer>-1-before.png   a minute before each prayer
 *   <n>-<prayer>-2-adhan.mp4    from 2 s before the prayer to 7 s after, in
 *                               real time: the change from one prayer to the
 *                               next as it is seen, at the frame rate the
 *                               browser managed
 *   <n>-<prayer>-3-after.png    a minute after its adhan moment ends
 *
 * Usage:
 *   node scripts/sky-capture/capture.mjs [--location istanbul] [--date 2026-11-27]
 *     [--theme skyV2] [--out dir] [--only day|prayers] [--prayers Fajr,Duhr]
 *
 * It starts Vite on port 5174 unless --base-url names a server already
 * running. Set CHROMIUM_PATH where Playwright's bundled browser is not the
 * one installed (this repo's cloud sandbox: see CLAUDE.md). Needs ffmpeg.
 *
 * The clock is Playwright's: installed at the moment wanted and paused, so a
 * still is that moment exactly, the time-lapse steps 48 s of the day per
 * frame, and a clip is recorded with the clock running from 2 s before the
 * prayer. The time-lapse runs with reduce motion on, so the water is still
 * (at 48 s a frame it would only flicker), and at 1x, since every frame
 * redraws the atmosphere; the stills and clips are at 2x. Settings are planted where
 * @capacitor/preferences reads them on the web, so setup is skipped.
 */

import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ZONES = { london: "Europe/London", belfast: "Europe/London", istanbul: "Europe/Istanbul" };
const PRAYERS = ["Fajr", "Shuruq", "Duhr", "Asr", "Maghrib", "Isha"];
const VIEWPORT = { width: 412, height: 560 };
const DAY_SECONDS = 60;
const FPS = 30;

function args() {
  const out = { location: "istanbul", theme: "skyV2", only: null, prayers: null, baseUrl: null, date: null, out: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "").replace(/-(\w)/g, (_, c) => c.toUpperCase());
    out[key] = argv[i + 1];
  }
  if (!(out.location in ZONES)) throw new Error(`--location must be one of ${Object.keys(ZONES).join(", ")}`);
  out.date ??= new Intl.DateTimeFormat("en-CA", { timeZone: ZONES[out.location] }).format(new Date());
  out.out = path.resolve(out.out ?? path.join(ROOT, "sky-capture", `${out.location}-${out.date}-${out.theme}`));
  out.prayers = out.prayers ? out.prayers.split(",") : PRAYERS;
  return out;
}

/** The instant a wall-clock time on `date` is, in `zone`. */
function zonedInstant(date, time, zone) {
  const guess = Date.parse(`${date}T${time}Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(guess)).map((p) => [p.type, p.value])
  );
  const seen = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return guess - (seen - guess);
}

async function startServer(baseUrl) {
  if (baseUrl) return { url: baseUrl, stop: () => {} };
  const url = "http://127.0.0.1:5174";
  const vite = spawn("npx", ["vite", "--port", "5174", "--strictPort", "--host", "127.0.0.1"], {
    cwd: ROOT, stdio: "ignore", detached: true,
  });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { url, stop: () => { try { process.kill(-vite.pid); } catch { /* gone */ } } };
}

function ffmpeg(...a) {
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${a.join(" ")}`);
}

async function main() {
  const opts = args();
  mkdirSync(opts.out, { recursive: true });
  const server = await startServer(opts.baseUrl);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--enable-unsafe-swiftshader"],
  });
  const zone = ZONES[opts.location];
  const settings = JSON.stringify({ location: opts.location, theme: opts.theme, timeZoneNoticeSeen: true });

  /** A page on a paused clock at `time`, with the card drawn. */
  async function openAt(context, time) {
    const page = await context.newPage();
    await page.addInitScript((s) => localStorage.setItem("CapacitorStorage.settings", s), settings);
    await page.clock.install({ time });
    await page.clock.pauseAt(time);
    await page.goto(server.url);
    await page.waitForSelector("[data-testid=strip-cell]");
    if (opts.theme === "skyV2") {
      await page.waitForSelector(".PrayerDayCard[data-real-sky-tone], .PrayerDayCard:not(.PrayerDayCard--real-sky)");
    }
    // One of the app's ticks, so everything has caught up with the clock.
    await page.clock.runFor(1000);
    await page.waitForTimeout(300);
    return page;
  }
  const card = (page) => page.locator(".PrayerDayCard").first();

  const context = (extra = {}) =>
    browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, timezoneId: zone, ...extra });

  // The day's times, from the app's own timetable code.
  const probe = await context();
  const page0 = await openAt(probe, zonedInstant(opts.date, "12:00:00", zone));
  const times = await page0.evaluate(
    async ({ location, date }) => {
      const m = await import("/src/lib/PrayerTimes.ts");
      const day = await m.createPrayerTimes(location, "shafi").getDay(new Date(`${date}T12:00:00Z`));
      return day.map((p) => p.time.getTime());
    },
    { location: opts.location, date: opts.date }
  );
  await probe.close();
  console.log(PRAYERS.map((p, i) => `${p} ${new Date(times[i]).toLocaleTimeString("en-GB", { timeZone: zone })}`).join(", "));

  if (opts.only !== "prayers") {
    console.log("day.mp4 ...");
    const frames = mkdtempSync(path.join(tmpdir(), "sky-day-"));
    // At 1x: every frame redraws the atmosphere, which in a software GPU
    // costs about a second at 2x.
    const ctx = await context({ reducedMotion: "reduce", deviceScaleFactor: 1 });
    const start = zonedInstant(opts.date, "00:00:00", zone);
    const page = await openAt(ctx, start);
    const total = DAY_SECONDS * FPS;
    const step = 86_400_000 / total;
    for (let i = 0; i < total; i++) {
      await card(page).screenshot({ path: path.join(frames, `${String(i).padStart(5, "0")}.png`) });
      await page.clock.runFor(step);
      await page.waitForTimeout(20);
      if (i % 150 === 0) process.stdout.write(`  ${Math.round((i / total) * 100)}%\n`);
    }
    await ctx.close();
    ffmpeg("-framerate", String(FPS), "-i", path.join(frames, "%05d.png"),
      "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "20",
      path.join(opts.out, "day.mp4"));
    rmSync(frames, { recursive: true, force: true });
  }

  if (opts.only !== "day") {
    for (const [i, name] of PRAYERS.entries()) {
      if (!opts.prayers.includes(name)) continue;
      const at = times[i];
      const stem = path.join(opts.out, `${i + 1}-${name.toLowerCase()}`);
      console.log(`${name} ...`);

      for (const [suffix, time] of [["1-before", at - 60_000], ["3-after", at + 6 * 60_000]]) {
        const ctx = await context();
        const page = await openAt(ctx, time);
        await card(page).screenshot({ path: `${stem}-${suffix}.png` });
        await ctx.close();
      }

      // The clip: the card captured at full resolution as fast as Chrome
      // allows, in real time with the clock running, each frame held for as
      // long as it was the latest.
      const frames = mkdtempSync(path.join(tmpdir(), "sky-clip-"));
      const ctx = await context();
      const page = await openAt(ctx, at - 2000 - 1000);
      const box = await card(page).boundingBox();
      const cdp = await ctx.newCDPSession(page);
      const clip = { ...box, scale: 2 };
      const shots = [];
      // openAt ran the clock on a second; it is 2 s before the prayer now.
      await page.clock.resume();
      const began = Date.now();
      while (Date.now() - began < 9_000) {
        const t = Date.now();
        const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92, clip });
        shots.push({ data, at: (t + Date.now()) / 2 - began });
      }
      await ctx.close();
      const list = [];
      shots.forEach((f, k) => {
        const file = path.join(frames, `${String(k).padStart(5, "0")}.jpg`);
        writeFileSync(file, Buffer.from(f.data, "base64"));
        const start = k === 0 ? 0 : f.at;
        const end = k + 1 < shots.length ? shots[k + 1].at : 9_000;
        list.push(`file '${file}'`, `duration ${(Math.max(1, end - start) / 1000).toFixed(3)}`);
      });
      list.push(`file '${path.join(frames, `${String(shots.length - 1).padStart(5, "0")}.jpg`)}'`);
      writeFileSync(path.join(frames, "list.txt"), list.join("\n"));
      console.log(`  ${shots.length} frames in 9 s`);
      ffmpeg("-f", "concat", "-safe", "0", "-i", path.join(frames, "list.txt"),
        "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2,fps=30", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "20", `${stem}-2-adhan.mp4`);
      rmSync(frames, { recursive: true, force: true });
    }
  }

  await browser.close();
  server.stop();
  console.log(`Wrote ${opts.out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
