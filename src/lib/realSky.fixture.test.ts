import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AsrMethod, PrayerLocation, createPrayerTimes } from "./PrayerTimes";
import { timetableZoneFor } from "./PrayerTimeData";
import { shiftZonedDay } from "./timeZone";
import { SKY_LOOK, SKY_PLACES, skyMoment, skyTimesFor } from "./realSky";

/**
 * What Sky V2's model says through a whole day, for the widgets' ports of
 * realSky.ts to be checked against (MEL-377), as fixtures/widget-payload is
 * for the payload. Written by the real model:
 *
 *   UPDATE_FIXTURES=1 npx vitest run realSky.fixture
 *
 * Every ten minutes from the day's midnight to the next, and every minute
 * through the hour before Fajr and the hour after Shuruq, where the dawn and
 * the disc's lift change fastest. Instants are UTC milliseconds, so the files
 * do not depend on the zone the suite runs in. The columns are the six
 * dots of a 380px card with 16px margins.
 */

const DIR = join(__dirname, "../../fixtures/real-sky");
const MINUTE = 60_000;
const COLUMNS = [0, 1, 2, 3, 4, 5].map((i) => (16 + ((i + 0.5) / 6) * 348) / 380);

const FIXTURES: Array<[string, PrayerLocation, string]> = [
  ["istanbul-2026-11-27.json", PrayerLocation.Istanbul, "2026-11-27"],
  ["london-2026-01-15.json", PrayerLocation.London, "2026-01-15"],
  ["london-2026-06-21.json", PrayerLocation.London, "2026-06-21"],
];

const round = (x: number) => Math.round(x * 1e6) / 1e6;

describe("real sky fixtures", () => {
  for (const [file, location, date] of FIXTURES) {
    it(`${file} is what realSky.ts says`, async () => {
      const times = createPrayerTimes(location, AsrMethod.Shafi);
      const zone = timetableZoneFor(location);
      const midday = new Date(`${date}T12:00:00Z`);
      const [y, t, n] = await Promise.all([
        times.getDay(shiftZonedDay(midday, zone, -1)),
        times.getDay(midday),
        times.getDay(shiftZonedDay(midday, zone, 1)),
      ]);
      const sky = skyTimesFor(y, t, n);
      const from = sky.fajr - ((sky.fajr - sky.prevIsha) / 2);
      const to = sky.isha + (sky.nextFajr - sky.isha) / 2;
      const at = new Set<number>();
      for (let x = Math.ceil(from / (10 * MINUTE)) * 10 * MINUTE; x <= to; x += 10 * MINUTE) at.add(x);
      for (let x = sky.fajr - 60 * MINUTE; x <= sky.fajr + 10 * MINUTE; x += MINUTE) at.add(x);
      for (let x = sky.shuruq - 5 * MINUTE; x <= sky.shuruq + 65 * MINUTE; x += MINUTE) at.add(x);
      const samples = [...at].sort((a, b) => a - b).map((now) => {
        const m = skyMoment(now, sky, SKY_PLACES[location], COLUMNS);
        return {
          t: now,
          el: round(m.sun.el),
          discEl: round(m.sun.discEl),
          az: round(m.sun.az),
          trueEl: round(m.sun.trueEl),
          bearing: round(m.bearing),
          exposure: round(m.exposure),
          fajrAge: round(m.fajrAge),
          dusk: round(m.dusk),
          stars: round(m.stars),
        };
      });
      const json =
        JSON.stringify(
          { location, place: SKY_PLACES[location], look: SKY_LOOK, columns: COLUMNS.map(round), times: sky, samples },
          null,
          1
        ) + "\n";
      const path = join(DIR, file);
      if (process.env.UPDATE_FIXTURES) writeFileSync(path, json);
      expect(existsSync(path), `${file} is missing; run with UPDATE_FIXTURES=1`).toBe(true);
      expect(readFileSync(path, "utf8"), `${file} is out of date; run with UPDATE_FIXTURES=1 and check the diff`).toEqual(json);
    });
  }
});
