import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildWidgetPayload } from "./widgetPayload";
import { AsrMethod, PrayerLocation } from "./PrayerTimes";
import { AppSettings, getDefaultSettings } from "./settings";
import { skyAt, skyAtDays, skyLightAtDays } from "./sky";

/**
 * The payloads the native widgets are tested against, written by the real
 * buildWidgetPayload rather than by hand.
 *
 * fixtures/widget-payload/ is read by the iOS widget tests, so a change to the
 * payload's shape or contents has to show up here as a changed file - and
 * then fails the Swift tests too, rather than leaving a widget that quietly
 * decodes nothing. When the change is intended:
 *
 *   UPDATE_FIXTURES=1 npx vitest run widgetPayload.fixture
 *
 * Every fixture reads times on the timetable's own clock, so the files do
 * not depend on the zone the suite runs in (npm run test:zones runs it under
 * five). 15 January, not February: the iOS widget previews carry February's
 * times as sample text, and a test on that date could pass on placeholders.
 */

const DIR = join(__dirname, "../../fixtures/widget-payload");

// Midnight UTC on 15 January 2026 - which in January is midnight in London -
// so the whole of the 15th is still ahead. Two days ahead is enough to cover
// the day after Isha and the end of the written window.
const NOW = new Date("2026-01-15T00:00:00Z");
const HORIZON_DAYS = 2;

const FIXTURES: Record<string, Partial<AppSettings>> = {
  "london-2026-01-15.json": { location: PrayerLocation.London },
  "london-hanafi-2026-01-15.json": {
    location: PrayerLocation.London,
    asrMethod: AsrMethod.Hanafi,
  },
  "belfast-2026-01-15.json": { location: PrayerLocation.Belfast },
  // 03:00 in Istanbul, which is three hours ahead of the UTC instant the
  // countdown runs on: the clock strings are Istanbul's, not London's.
  "istanbul-2026-01-15.json": { location: PrayerLocation.Istanbul },
};

describe("widget payload fixtures", () => {
  for (const [file, overrides] of Object.entries(FIXTURES)) {
    it(`${file} is what buildWidgetPayload writes`, async () => {
      const settings = { ...getDefaultSettings(), ...overrides };
      const payload = await buildWidgetPayload(settings, NOW, HORIZON_DAYS);
      const json = JSON.stringify(payload, null, 2) + "\n";
      const path = join(DIR, file);

      if (process.env.UPDATE_FIXTURES) {
        writeFileSync(path, json);
      }
      expect(existsSync(path), `${file} is missing; run with UPDATE_FIXTURES=1`).toBe(true);
      expect(
        readFileSync(path, "utf8"),
        `${file} is out of date; run with UPDATE_FIXTURES=1 and check the diff`
      ).toEqual(json);
    });
  }
});

/**
 * What a Sky widget should draw, sampled across the London fixture's two
 * days, for the native widgets to check their own blend against.
 *
 * The native code repeats skyAtDays from the payload's `sky` and
 * `skyColours`, so this holds it to the same answer: every ten minutes, and
 * every minute through dawn and golden hour into sunset, where the colours
 * move fastest and the text colour flips - and the light on the sky that is
 * not its colour: the sun's strength, the dawn glow and Fajr's thread, which
 * the minute-by-minute dawn covers from before the thread starts until after
 * the dawn glow has gone. Also written with UPDATE_FIXTURES=1.
 */
/** Every number in `value`, to twelve decimal places. */
function roundNumbers<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) =>
      typeof v === "number" ? Number(v.toFixed(12)) : v
    )
  );
}

describe("sky samples fixture", () => {
  const FILE = "sky-london-2026-01-15.json";
  const MINUTE = 60_000;

  function sampleTimes(): Array<number> {
    const start = NOW.getTime();
    const times = new Set<number>();
    for (let t = start; t < start + 2 * 24 * 60 * MINUTE; t += 10 * MINUTE) {
      times.add(t);
    }
    // 15 January: Fajr 06:20, Shuruq 07:57, Maghrib 16:24, all GMT.
    const minuteByMinute: Array<[string, string]> = [
      ["2026-01-15T05:10:00Z", "2026-01-15T08:30:00Z"],
      ["2026-01-15T15:50:00Z", "2026-01-15T16:40:00Z"],
    ];
    for (const [from, to] of minuteByMinute) {
      for (let t = Date.parse(from); t <= Date.parse(to); t += MINUTE) {
        times.add(t);
      }
    }
    return [...times].sort((a, b) => a - b);
  }

  it(`${FILE} is what skyAtDays gives for london-2026-01-15.json`, async () => {
    const settings = { ...getDefaultSettings(), location: PrayerLocation.London };
    const payload = (await buildWidgetPayload(settings, NOW, HORIZON_DAYS))!;
    const days = payload.days.map((d) => d.sky);

    const samples = sampleTimes().map((at) => {
      const sky = skyAtDays(at, days);
      return {
        at,
        top: sky.top,
        mid: sky.mid,
        horizon: sky.horizon,
        text: sky.text,
        sun: sky.sun,
        night: sky.night,
        // The sun's strength, the dawn glow and Fajr's thread (skyLightAtDays),
        // to twelve places: Math.pow can round its last bit differently from
        // one machine to another, and this file is compared exactly. The
        // native tests allow 1e-9.
        light: roundNumbers(skyLightAtDays(at, days)),
      };
    });
    const json =
      JSON.stringify({ payload: "london-2026-01-15.json", samples }, null, 2) + "\n";
    const path = join(DIR, FILE);

    if (process.env.UPDATE_FIXTURES) {
      writeFileSync(path, json);
    }
    expect(existsSync(path), `${FILE} is missing; run with UPDATE_FIXTURES=1`).toBe(true);
    expect(
      readFileSync(path, "utf8"),
      `${FILE} is out of date; run with UPDATE_FIXTURES=1 and check the diff`
    ).toEqual(json);
  });

  // A widget holds a run of days and picks one itself, where the app is told
  // which day it is; the two must agree on everything a widget draws.
  it("Should agree with the app's sky at every sample", async () => {
    const settings = { ...getDefaultSettings(), location: PrayerLocation.London };
    const payload = (await buildWidgetPayload(settings, NOW, HORIZON_DAYS))!;
    const times = (await import("./PrayerTimes")).createPrayerTimes(
      PrayerLocation.London,
      AsrMethod.Shafi
    );
    const days = payload.days.map((d) => d.sky);
    for (const at of sampleTimes()) {
      const widget = skyAtDays(at, days);
      const app = skyAt(new Date(at), await times.getDay(new Date(at)));
      expect([widget.top, widget.mid, widget.horizon, widget.text, widget.night]).toEqual([
        app.top,
        app.mid,
        app.horizon,
        app.text,
        app.night,
      ]);
      expect(widget.sun).toEqual(app.sun);
    }
  });

  // Widgets use one text colour for everything on them, so the sky has to
  // agree with itself top to bottom. It does because the colours all cross
  // between dark and light at the same instant (blend in sky.ts).
  it("Should give the same text colour for the top and bottom of the sky", async () => {
    const settings = { ...getDefaultSettings(), location: PrayerLocation.London };
    const payload = (await buildWidgetPayload(settings, NOW, HORIZON_DAYS))!;
    const days = payload.days.map((d) => d.sky);
    for (const at of sampleTimes()) {
      const sky = skyAtDays(at, days);
      expect(sky.lowerText, new Date(at).toISOString()).toBe(sky.text);
    }
  });
});
