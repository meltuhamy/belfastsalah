import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildWidgetPayload } from "./widgetPayload";
import { AsrMethod, PrayerLocation } from "./PrayerTimes";
import { AppSettings, getDefaultSettings } from "./settings";

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
