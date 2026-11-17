import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildReminderPayload } from "./reminderPayload";
import { PrayerLocation } from "./PrayerTimes";
import { AppSettings, getDefaultSettings } from "./settings";

/**
 * The lists the native re-plan is tested against, written by the real
 * buildReminderPayload rather than by hand.
 *
 * fixtures/reminder-payload/ is read by the Kotlin tests, so a change to the
 * payload's shape or to a prayer instant has to show up here as a changed
 * file - and then fail those tests too, rather than leaving a phone that
 * rearms the wrong window. When the change is intended:
 *
 *   UPDATE_FIXTURES=1 npx vitest run reminderPayload.fixture
 *
 * Both fixtures read times on the timetable's own clock, so the files do
 * not depend on the zone the suite runs in. Each one spans a 2026 clock
 * change: 29 March, when the UK springs forward, and 25 October, when it
 * falls back. Four days is enough for a 48 hour window on either side of
 * the change and for the prompt, which sits at the end of the list.
 */

const DIR = join(__dirname, "../../fixtures/reminder-payload");
const HORIZON_DAYS = 4;

const FIXTURES: Record<string, { now: string; settings: Partial<AppSettings> }> =
  {
    "london-spring-2026-03-28.json": {
      now: "2026-03-28T00:00:00Z",
      settings: { location: PrayerLocation.London },
    },
    "london-autumn-2026-10-24.json": {
      now: "2026-10-24T00:00:00Z",
      settings: { location: PrayerLocation.London },
    },
  };

describe("reminder payload fixtures", () => {
  for (const [file, fixture] of Object.entries(FIXTURES)) {
    it(`${file} is what buildReminderPayload writes`, async () => {
      const settings = { ...getDefaultSettings(), ...fixture.settings };
      const payload = await buildReminderPayload(
        settings,
        new Date(fixture.now),
        HORIZON_DAYS
      );
      const json = JSON.stringify(payload, null, 2) + "\n";
      const path = join(DIR, file);

      if (process.env.UPDATE_FIXTURES) {
        writeFileSync(path, json);
      }
      expect(existsSync(path), `${file} is missing; run with UPDATE_FIXTURES=1`).toBe(
        true
      );
      expect(
        readFileSync(path, "utf8"),
        `${file} is out of date; run with UPDATE_FIXTURES=1 and check the diff`
      ).toEqual(json);
    });
  }
});
