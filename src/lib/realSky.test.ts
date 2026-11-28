import {
  AsrMethod,
  Prayer,
  PrayerDayTimes,
  PrayerLocation,
  createPrayerTimes,
} from "./PrayerTimes";
import { timetableZoneFor } from "./PrayerTimeData";
import { shiftZonedDay } from "./timeZone";
import {
  FAJR_ANGLE,
  ISHA_ANGLE,
  MASK_SCALE,
  SKY_LOOK,
  SKY_PLACES,
  SkyTimes,
  chooseTone,
  contrastOn,
  dimFor,
  discShowing,
  duskProgress,
  exposure,
  fajrAge,
  giveWayMask,
  haloFor,
  luminancesUnder,
  nextWaterPace,
  WATER_START,
  WaterPace,
  onCard,
  prayerInstants,
  shownSun,
  shuruqLift,
  skyClock,
  skyTimesFor,
  starsShowing,
  sunPosition,
  viewBearing,
} from "./realSky";

const MINUTE = 60_000;
const R = SKY_LOOK.sunRadius;
/** Six equal columns across the card, as the strip has them. */
const COLUMNS = [0, 1, 2, 3, 4, 5].map((i) => (i + 0.5) / 6 * 0.92 + 0.04);

async function timesFor(location: PrayerLocation, iso: string): Promise<SkyTimes> {
  const times = createPrayerTimes(location, AsrMethod.Shafi);
  const zone = timetableZoneFor(location);
  const midday = new Date(`${iso}T12:00:00Z`);
  const [y, t, n] = await Promise.all([
    times.getDay(shiftZonedDay(midday, zone, -1)),
    times.getDay(midday),
    times.getDay(shiftZonedDay(midday, zone, 1)),
  ]);
  return skyTimesFor(y as PrayerDayTimes, t, n);
}

// Two days a month through 2026, for every timetable: every season, both
// clock changes' months, and London's last file year.
const DAYS = Array.from({ length: 12 }, (_, m) => [1, 15].map((d) =>
  `2026-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`)).flat();
const LOCATIONS = [PrayerLocation.London, PrayerLocation.Belfast, PrayerLocation.Istanbul];

describe("sunPosition", () => {
  it("puts the June solstice's noon sun over London where the latitude says", () => {
    // Solar noon at Charing Cross on 21 June 2026 is about 12:01:30 UTC.
    let highest = -90;
    for (let m = 0; m < 30; m++) {
      highest = Math.max(highest, sunPosition(Date.UTC(2026, 5, 21, 11, 50 + m), SKY_PLACES.london).el);
    }
    expect(highest).toBeCloseTo(90 - 51.5073 + 23.434, 1);
  });

  it("has the sun due south at noon, east in the morning and west in the evening", () => {
    const place = SKY_PLACES.istanbul;
    expect(sunPosition(Date.UTC(2026, 10, 27, 4, 0), place).az).toBeGreaterThan(90);
    expect(sunPosition(Date.UTC(2026, 10, 27, 4, 0), place).az).toBeLessThan(150);
    // Solar noon is 09:51 UTC: mean noon at 28.97 E is 10:04, and the
    // equation of time is +12.6 minutes in late November.
    expect(Math.abs(sunPosition(Date.UTC(2026, 10, 27, 9, 51), place).az - 180)).toBeLessThan(0.5);
    expect(sunPosition(Date.UTC(2026, 10, 27, 14, 0), place).az).toBeGreaterThan(210);
  });

  it("agrees with Diyanet's Fajr angle at Istanbul's Fajr", async () => {
    // Diyanet calls Fajr at 18 degrees, then takes a little margin.
    const t = await timesFor(PrayerLocation.Istanbul, "2026-11-27");
    expect(sunPosition(t.fajr, SKY_PLACES.istanbul).el).toBeCloseTo(-18, 0);
  });
});

describe("shownSun", () => {
  for (const location of LOCATIONS) {
    describe(location, () => {
      const place = SKY_PLACES[location];
      let all: SkyTimes[];
      beforeAll(async () => {
        all = await Promise.all(DAYS.map((d) => timesFor(location, d)));
      });

      it("meets the anchors exactly, every day", () => {
        for (const t of all) {
          expect(shownSun(t.fajr, t, place).el).toBeCloseTo(FAJR_ANGLE, 6);
          expect(shownSun(t.shuruq, t, place).el).toBeCloseTo(-R, 6);
          expect(shownSun(t.shuruq, t, place).discEl).toBeCloseTo(-R, 6);
          expect(shownSun(t.maghrib, t, place).el).toBeCloseTo(-R, 6);
          expect(shownSun(t.isha, t, place).el).toBeCloseTo(ISHA_ANGLE, 6);
        }
      });

      // The offset is the timetable's own margins: under a degree for
      // Istanbul, whose Diyanet table uses the anchors' own angles. London's
      // and Belfast's summer twilight never reaches 18 degrees - the real sun
      // is only about 9 below at a June Isha - so there the anchors put the
      // sky's light up to about 8 degrees deeper than the real sun's: the
      // timetable's night, not the sky's.
      it("stays close to the real sun, as far as the timetable lets it", () => {
        const most = location === PrayerLocation.Istanbul ? 1 : 9;
        for (const t of all) {
          for (let now = t.fajr; now <= t.isha; now += 10 * MINUTE) {
            const sun = shownSun(now, t, place);
            expect(Math.abs(sun.el - sun.trueEl)).toBeLessThan(most);
          }
        }
      });

      it("moves smoothly through the whole night and day, Isha to Isha", () => {
        for (const t of all) {
          let last = shownSun(t.prevIsha, t, place).el;
          for (let now = t.prevIsha + MINUTE; now <= t.nextFajr; now += MINUTE) {
            const el = shownSun(now, t, place).el;
            expect(Math.abs(el - last)).toBeLessThan(0.4);
            last = el;
          }
        }
      });

      it("is up from Shuruq to Maghrib, and down outside them", () => {
        for (const t of all) {
          expect(shownSun(t.duhr, t, place).el).toBeGreaterThan(10);
          expect(shownSun(t.shuruq - MINUTE, t, place).discEl).toBeLessThan(-R);
          expect(shownSun(t.maghrib + MINUTE, t, place).discEl).toBeLessThan(-R);
        }
      });
    });
  }
});

describe("shuruqLift", () => {
  it("lifts the disc clear of the line over a minute, then gives it back over the hour", () => {
    const L = 2 * R + 1;
    expect(shuruqLift(-1)).toBe(0);
    expect(shuruqLift(0)).toBe(0);
    expect(shuruqLift(0.5)).toBeCloseTo(L / 2, 6);
    expect(shuruqLift(1)).toBeCloseTo(L, 6);
    expect(shuruqLift(31)).toBeCloseTo(L / 2, 6);
    expect(shuruqLift(61)).toBe(0);
    expect(shuruqLift(200)).toBe(0);
  });

  it("never moves the disc backwards in the hour after Shuruq", async () => {
    for (const location of LOCATIONS) {
      const t = await timesFor(location, "2026-03-15");
      const place = SKY_PLACES[location];
      let last = -Infinity;
      for (let s = 0; s <= 70 * 60; s += 5) {
        const disc = shownSun(t.shuruq + s * 1000, t, place).discEl;
        expect(disc).toBeGreaterThanOrEqual(last - 1e-9);
        last = disc;
      }
    }
  });
});

describe("viewBearing", () => {
  for (const location of LOCATIONS) {
    it(`puts ${location}'s sun over each prayer's dot at its time`, async () => {
      const place = SKY_PLACES[location];
      for (const day of ["2026-01-15", "2026-06-15", "2026-11-27"]) {
        const t = await timesFor(location, day);
        prayerInstants(t).forEach((at, i) => {
          const bearing = viewBearing(at, t, place, COLUMNS);
          const sun = sunPosition(at, place);
          const x = onCard(sun.el, sun.az, bearing, { width: 380, height: 252, horizon: 90 }).x;
          expect(x / 380).toBeCloseTo(COLUMNS[i], 6);
        });
      }
    });

    it(`turns ${location}'s view smoothly through the night, without a jump`, async () => {
      const place = SKY_PLACES[location];
      const t = await timesFor(location, "2026-02-15");
      let last = viewBearing(t.prevIsha, t, place, COLUMNS);
      for (let now = t.prevIsha + MINUTE; now <= t.nextFajr; now += MINUTE) {
        const b = viewBearing(now, t, place, COLUMNS);
        expect(Math.abs(b - last)).toBeLessThan(0.6);
        last = b;
      }
    });
  }
});

describe("onCard", () => {
  it("puts the middle of the view at the middle, and the horizon where it is measured", () => {
    expect(onCard(0, 180, 180, { width: 380, height: 252, horizon: 90 })).toEqual({ x: 190, y: 162 });
  });

  it("keeps the sky's scale: one px is the same angle either way", () => {
    const perPx = SKY_LOOK.fieldOfView / 380;
    const p = onCard(10, 190, 180, { width: 380, height: 252, horizon: 90 });
    expect(p.x - 190).toBeCloseTo(10 / perPx, 6);
    expect(162 - p.y).toBeCloseTo(10 / perPx, 6);
  });

  it("takes the short way round north", () => {
    expect(onCard(0, 350, 10, { width: 380, height: 252, horizon: 90 }).x).toBeLessThan(190);
  });
});

describe("light", () => {
  it("opens the exposure up through twilight, one stop per 2.6 degrees, capped", () => {
    expect(exposure(10)).toBeCloseTo(0.55, 6);
    expect(exposure(4)).toBeCloseTo(0.55, 6);
    expect(exposure(4 - 2.6)).toBeCloseTo(1.1, 6);
    expect(exposure(-30)).toBeCloseTo(0.55 * Math.pow(2, 5.2), 6);
    expect(exposure(-30)).toBe(exposure(ISHA_ANGLE - 5));
  });

  it("brings the stars out past civil twilight", () => {
    expect(starsShowing(0)).toBe(0);
    expect(starsShowing(-5)).toBe(0);
    expect(starsShowing(-9)).toBeCloseTo(0.5, 6);
    expect(starsShowing(-13)).toBe(1);
  });

  it("times the red twilight from Maghrib to Isha", async () => {
    const t = await timesFor(PrayerLocation.Istanbul, "2026-11-27");
    expect(duskProgress(t.maghrib, t)).toBe(0);
    expect(duskProgress(t.isha, t)).toBe(1);
    expect(duskProgress((t.maghrib + t.isha) / 2, t)).toBeCloseTo(0.5, 6);
  });

  it("counts Fajr's age from the Fajr the night is waiting for", async () => {
    const t = await timesFor(PrayerLocation.Istanbul, "2026-11-27");
    expect(fajrAge(t.fajr - 2 * MINUTE, t)).toBe(-2);
    expect(fajrAge(t.fajr + 3 * MINUTE, t)).toBe(3);
    expect(fajrAge(t.isha + MINUTE, t)).toBeCloseTo((t.isha + MINUTE - t.nextFajr) / MINUTE, 6);
  });

  it("fades the flare with the disc as it crosses the horizon", () => {
    expect(discShowing(-R)).toBe(0);
    expect(discShowing(0)).toBe(0.5);
    expect(discShowing(R)).toBe(1);
  });
});

describe("skyClock", () => {
  it("draws the atmosphere once a minute, and every five seconds around Fajr", async () => {
    const t = await timesFor(PrayerLocation.London, "2026-02-15");
    const noon = t.duhr + 30_500;
    expect(skyClock(noon, t)).toBe(Math.floor(noon / MINUTE) * MINUTE);
    const fajr = t.fajr + 7_300;
    expect(skyClock(fajr, t)).toBe(Math.floor(fajr / 5000) * 5000);
    expect(skyClock(t.fajr + 7 * MINUTE + 1000, t) % MINUTE).toBe(0);
  });
});

describe("the text colour", () => {
  it("judges black on the darkest pixels and white on the brightest", () => {
    const lums = [0.01, ...Array(98).fill(0.5), 0.99];
    const c = contrastOn(lums);
    expect(c.black).toBeCloseTo((0.5 + 0.05) / 0.05, 6);
    expect(c.white).toBeCloseTo(1.05 / (0.5 + 0.05), 6);
    // Under 5% of the box is the glint: it does not count yet.
    const glint = [...Array(96).fill(0.02), ...Array(4).fill(0.9)];
    expect(contrastOn(glint).white).toBeCloseTo(1.05 / 0.07, 6);
  });

  it("picks the colour with the smaller shortfall, words counted by size", () => {
    const word = (black: number, white: number, weight = 1) => ({ contrast: { black, white }, weight });
    expect(chooseTone([word(8, 2)], null)).toBe("black");
    expect(chooseTone([word(2, 8)], null)).toBe("white");
    // A big word short on black outweighs a small one short on white.
    expect(chooseTone([word(3, 9, 10), word(9, 3, 1)], null)).toBe("white");
  });

  it("keeps the colour it has until the other is clearly better", () => {
    const word = (black: number, white: number) => ({ contrast: { black, white }, weight: 10 });
    // Black falls a little short, white a little less: no flip.
    expect(chooseTone([word(3.8, 4)], "black")).toBe("black");
    // White now reads and black does not: flip.
    expect(chooseTone([word(2, 6)], "black")).toBe("white");
  });

  it("only gives a halo for the shortfall left, and fades the others as far as can be spared", () => {
    expect(haloFor(4.5)).toBe(0);
    expect(haloFor(6)).toBe(0);
    expect(haloFor(3)).toBeCloseTo(0.7, 6);
    expect(haloFor(1)).toBe(1);
    expect(dimFor(8)).toBe(0.72);
    expect(dimFor(6)).toBe(0.85);
    expect(dimFor(4)).toBe(1);
  });

  it("reads the pixels under a box, with the pane mixed in", () => {
    const data = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < 16; i++) data.set([0, 0, 0, 255], i * 4);
    const pixels = { data, width: 4, height: 4 };
    expect(luminancesUnder(pixels, { left: 0, top: 0, right: 4, bottom: 4 })).toEqual([0, 0, 0, 0]);
    const paned = luminancesUnder(pixels, { left: 0, top: 0, right: 4, bottom: 4 }, 0.5);
    expect(paned[0]).toBeGreaterThan(0.2);
  });
});

describe("giveWayMask", () => {
  it("marks white words red and black words green, feathered", () => {
    const mask = giveWayMask({ width: 400, height: 200 }, [
      { box: { left: 40, top: 40, right: 160, bottom: 80 }, tone: "white" },
      { box: { left: 240, top: 120, right: 360, bottom: 160 }, tone: "black" },
    ]);
    expect(mask.width).toBe(400 * MASK_SCALE);
    const at = (x: number, y: number) => {
      const k = (Math.round(y * MASK_SCALE) * mask.width + Math.round(x * MASK_SCALE)) * 4;
      return [mask.data[k], mask.data[k + 1]];
    };
    expect(at(100, 60)[0]).toBeGreaterThan(200);
    expect(at(100, 60)[1]).toBe(0);
    expect(at(300, 140)[1]).toBeGreaterThan(200);
    expect(at(300, 140)[0]).toBe(0);
    // Soft at the edge, gone well clear of it.
    const edge = at(40, 60)[0];
    expect(edge).toBeGreaterThan(20);
    expect(edge).toBeLessThan(200);
    expect(at(10, 180)).toEqual([0, 0]);
  });
});

describe("skyTimesFor", () => {
  it("takes the night's ends from the neighbouring days", async () => {
    const t = await timesFor(PrayerLocation.London, "2026-02-15");
    const london = createPrayerTimes(PrayerLocation.London, AsrMethod.Shafi);
    const [feb14, feb16] = await Promise.all([
      london.getDay(new Date("2026-02-14T12:00:00Z")),
      london.getDay(new Date("2026-02-16T12:00:00Z")),
    ]);
    expect(t.prevIsha).toBe(feb14[Prayer.Isha].time.getTime());
    expect(t.nextFajr).toBe(feb16[Prayer.Fajr].time.getTime());
    expect(new Date(t.fajr).toISOString()).toBe("2026-02-15T05:35:00.000Z");
  });
});

describe("nextWaterPace", () => {
  const run = (gaps: number[], from: WaterPace = WATER_START) =>
    gaps.reduce(nextWaterPace, from);

  it("draws the water at 30 a second while the frames keep time", () => {
    expect(run(Array(600).fill(16.7)).fps).toBe(30);
  });

  it("takes a 30 Hz screen's own pace as on time", () => {
    expect(run(Array(600).fill(33.3)).fps).toBe(30);
  });

  it("ignores a hitch now and then", () => {
    const gaps = Array.from({ length: 600 }, (_, i) => (i % 10 === 0 ? 60 : 16.7));
    expect(run(gaps).fps).toBe(30);
  });

  it("steps down when frames come late, and stills the water if they stay late", () => {
    const late = [16.7, ...Array(12).fill(45)];
    expect(run(late).fps).toBe(15);
    expect(run([...late, ...Array(12).fill(45)]).fps).toBe(8);
    expect(run([...late, ...Array(24).fill(45)]).fps).toBe(0);
  });
});
