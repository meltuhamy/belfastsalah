import {
  AsrMethod,
  PrayerDayTimes,
  PrayerLocation,
  createPrayerTimes,
} from "./PrayerTimes";
import { getAvailableYears } from "./PrayerTimeData";
import {
  TEXT_COLOURS,
  contrastRatio,
  dayBand,
  dayFraction,
  mixOklab,
  skyAt,
  skyPoints,
  skyProperties,
  skyTints,
} from "./sky";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const london = createPrayerTimes(PrayerLocation.London, AsrMethod.Shafi);
const londonHanafi = createPrayerTimes(PrayerLocation.London, AsrMethod.Hanafi);
const belfast = createPrayerTimes(PrayerLocation.Belfast, AsrMethod.Shafi);
const istanbul = createPrayerTimes(PrayerLocation.Istanbul, AsrMethod.Shafi);

const lastYear = (location: PrayerLocation) => {
  const years = getAvailableYears(location);
  return years[years.length - 1];
};

// London's files stop in 2026 and its later years are calculated on the
// device, so those are named rather than listed: the first, one in the middle
// and the last the old files reached.
const LONDON_YEARS = [...getAvailableYears(PrayerLocation.London), 2027, 2050, 2076];

async function year(times: typeof london, y: number): Promise<Array<PrayerDayTimes>> {
  const days: Array<PrayerDayTimes> = [];
  for (let month = 0; month < 12; month++) {
    days.push(...(await times.getMonth(month, y)));
  }
  return days;
}

/** Every instant from three hours before Fajr until a day later, `step` apart. */
function* across(day: PrayerDayTimes, step: number) {
  const start = day[0].time.getTime() - 3 * HOUR;
  for (let t = start; t < start + 24 * HOUR; t += step) {
    yield new Date(t);
  }
}

function channels(hex: string): Array<number> {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function largestChange(a: string, b: string): number {
  const x = channels(a);
  const y = channels(b);
  return Math.max(...x.map((v, i) => Math.abs(v - y[i])));
}

/** How well the chosen text reads on the part of the sky it is drawn over. */
function readability(now: Date, day: PrayerDayTimes) {
  const sky = skyAt(now, day);
  const upper = TEXT_COLOURS[sky.text];
  const lower = TEXT_COLOURS[sky.lowerText];
  return {
    upper: Math.min(contrastRatio(upper, sky.top), contrastRatio(upper, sky.mid)),
    lower: Math.min(contrastRatio(lower, sky.mid), contrastRatio(lower, sky.horizon)),
  };
}

describe("skyPoints", () => {
  // The blend between points assumes they are in order. Fajr - 60 and
  // Isha + 90 are the ones that could overtake a neighbour, in the short
  // nights of June, so every day of every timetable is checked.
  it.each([
    ["London (Shafi)", london, LONDON_YEARS],
    ["London (Hanafi)", londonHanafi, LONDON_YEARS],
    ["Belfast", belfast, getAvailableYears(PrayerLocation.Belfast)],
    ["Istanbul", istanbul, getAvailableYears(PrayerLocation.Istanbul)],
  ] as const)(
    "Should be in order on every day of %s's timetables",
    async (_name, times, years) => {
      const outOfOrder: Array<string> = [];
      for (const y of years) {
        for (const day of await year(times, y)) {
          const points = skyPoints(day);
          for (let i = 1; i < points.length; i++) {
            if (points[i].at <= points[i - 1].at) {
              outOfOrder.push(
                `${day[0].time.toISOString().slice(0, 10)}: ${points[i - 1].phase} then ${points[i].phase}`
              );
            }
          }
        }
      }
      expect(outOfOrder).toEqual([]);
    },
    60_000
  );
});

describe("skyAt", () => {
  it("Should name the stretch of the day it is in", async () => {
    // 15 January 2026: Fajr 06:20, Shuruq 07:57, Duhr 12:15, Asr 14:02,
    // Maghrib 16:24, Isha 18:01, all GMT.
    const day = await london.getDay(new Date("2026-01-15T12:00:00Z"));
    const phaseAt = (iso: string) => skyAt(new Date(iso), day).phase;
    expect(phaseAt("2026-01-15T03:00:00Z")).toBe("night");
    expect(phaseAt("2026-01-15T06:30:00Z")).toBe("dawn");
    expect(phaseAt("2026-01-15T08:05:00Z")).toBe("sunrise");
    expect(phaseAt("2026-01-15T10:00:00Z")).toBe("morning");
    expect(phaseAt("2026-01-15T12:30:00Z")).toBe("midday");
    expect(phaseAt("2026-01-15T14:30:00Z")).toBe("afternoon");
    expect(phaseAt("2026-01-15T16:05:00Z")).toBe("golden");
    expect(phaseAt("2026-01-15T16:30:00Z")).toBe("sunset");
    expect(phaseAt("2026-01-15T18:30:00Z")).toBe("dusk");
    expect(phaseAt("2026-01-15T22:00:00Z")).toBe("lateNight");
  });

  it("Should put dark text on the day's sky and light text on the night's", async () => {
    const day = await london.getDay(new Date("2026-01-15T12:00:00Z"));
    expect(skyAt(new Date("2026-01-15T12:30:00Z"), day).text).toBe("dark");
    expect(skyAt(new Date("2026-01-15T21:00:00Z"), day).text).toBe("light");
    expect(skyAt(new Date("2026-01-15T16:40:00Z"), day).text).toBe("light");
  });

  it("Should only show the sun between sunrise and sunset, highest in between", async () => {
    const day = await london.getDay(new Date("2026-01-15T12:00:00Z"));
    expect(skyAt(new Date("2026-01-15T03:00:00Z"), day).sun).toBeNull();
    expect(skyAt(new Date("2026-01-15T21:00:00Z"), day).sun).toBeNull();

    const morning = skyAt(new Date("2026-01-15T09:00:00Z"), day).sun!;
    const noon = skyAt(new Date("2026-01-15T12:10:00Z"), day).sun!;
    const evening = skyAt(new Date("2026-01-15T15:30:00Z"), day).sun!;
    expect(morning.x).toBeLessThan(noon.x);
    expect(noon.x).toBeLessThan(evening.x);
    // y counts down from the top.
    expect(noon.y).toBeLessThan(morning.y);
    expect(noon.y).toBeLessThan(evening.y);
  });

  it("Should bring the stars out after Isha and take them in before Fajr", async () => {
    const day = await london.getDay(new Date("2026-01-15T12:00:00Z"));
    expect(skyAt(new Date("2026-01-15T12:00:00Z"), day).night).toBe(0);
    expect(skyAt(new Date("2026-01-15T18:31:00Z"), day).night).toBeCloseTo(0.5);
    expect(skyAt(new Date("2026-01-15T22:00:00Z"), day).night).toBe(1);
    expect(skyAt(new Date("2026-01-15T02:00:00Z"), day).night).toBe(1);
    expect(skyAt(new Date("2026-01-15T06:00:00Z"), day).night).toBeCloseTo(0.5);
  });

  // The two ends of the day are the same night, so the sky the app shows does
  // not change when the timetable rolls over to the next day at midnight.
  it("Should show the same sky either side of midnight", async () => {
    const before = await london.getDay(new Date("2026-01-15T12:00:00Z"));
    const after = await london.getDay(new Date("2026-01-16T12:00:00Z"));
    const a = skyAt(new Date("2026-01-15T23:59:59Z"), before);
    const b = skyAt(new Date("2026-01-16T00:00:00Z"), after);
    expect([b.top, b.mid, b.horizon]).toEqual([a.top, a.mid, a.horizon]);
  });

  // Text on the card sits on the top half of the sky, and the strip's
  // highlight on the lower half. Whatever the hour, one of the two text
  // colours has to read at 4.5:1 against all of the sky behind it - including
  // the minutes when the sky is changing between dark and light.
  it.each([
    ["London (Shafi)", london, 2026],
    ["London (Hanafi)", londonHanafi, 2026],
    ["London", london, 2076],
    ["Belfast", belfast, lastYear(PrayerLocation.Belfast)],
    ["Istanbul", istanbul, lastYear(PrayerLocation.Istanbul)],
  ] as const)(
    "Should keep its text readable every five minutes of %s's %i",
    async (_name, times, y) => {
      const failures: Array<string> = [];
      for (const day of await year(times, y)) {
        for (const now of across(day, 5 * MINUTE)) {
          const { upper, lower } = readability(now, day);
          if (upper < 4.5 || lower < 4.5) {
            failures.push(`${now.toISOString()}: ${upper.toFixed(2)} / ${lower.toFixed(2)}`);
          }
        }
      }
      expect(failures.slice(0, 10)).toEqual([]);
    },
    60_000
  );

  // Days where something could go wrong: the shortest and longest, and the
  // two clock changes, checked minute by minute rather than every five.
  it.each([
    "2026-03-29T12:00:00Z",
    "2026-06-21T12:00:00Z",
    "2026-10-25T12:00:00Z",
    "2026-12-21T12:00:00Z",
  ])("Should change gradually through %s", async (iso) => {
    const day = await london.getDay(new Date(iso));
    let previous = skyAt(new Date(day[0].time.getTime() - 3 * HOUR), day);
    let largest = 0;
    for (const now of across(day, MINUTE)) {
      const sky = skyAt(now, day);
      largest = Math.max(
        largest,
        largestChange(sky.top, previous.top),
        largestChange(sky.mid, previous.mid),
        largestChange(sky.horizon, previous.horizon)
      );
      const { upper, lower } = readability(now, day);
      expect(Math.min(upper, lower)).toBeGreaterThanOrEqual(4.5);
      previous = sky;
    }
    // Golden hour to sunset is the quickest change, at 25 minutes. A jump
    // would show up as hundreds.
    expect(largest).toBeLessThanOrEqual(16);
  });
});

describe("skyTints", () => {
  it("Should keep the page near white by day and near black by night", async () => {
    const day = await london.getDay(new Date("2026-01-15T12:00:00Z"));
    for (const point of skyPoints(day)) {
      const light = skyTints(point, false);
      const dark = skyTints(point, true);
      expect(contrastRatio(light.page, "#000000")).toBeGreaterThan(15);
      expect(contrastRatio(light.stripe, "#000000")).toBeGreaterThan(15);
      expect(contrastRatio(dark.page, "#ffffff")).toBeGreaterThan(10);
      expect(contrastRatio(dark.stripe, "#ffffff")).toBeGreaterThan(9);
    }
  });

  it("Should give an accent that reads on the page and under its own text", async () => {
    const day = await london.getDay(new Date("2026-01-15T12:00:00Z"));
    for (const point of skyPoints(day)) {
      for (const dark of [false, true]) {
        const tints = skyTints(point, dark);
        expect(contrastRatio(tints.accent, tints.page)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(tints.accent, tints.accentContrast)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("the day band", () => {
  const LONDON = "Europe/London";

  it("Should run from the timetable's midnight to the next", async () => {
    const day = await london.getDay(new Date("2026-01-15T12:00:00Z"));
    expect(dayFraction(new Date("2026-01-15T00:00:00Z"), day, LONDON)).toBe(0);
    expect(dayFraction(new Date("2026-01-15T12:00:00Z"), day, LONDON)).toBe(0.5);
    expect(dayFraction(new Date("2026-01-16T00:00:00Z"), day, LONDON)).toBe(1);
  });

  // 29 March 2026 is 23 hours long in London, starting at 00:00 GMT.
  it("Should be 23 hours long on the day the clocks go forward", async () => {
    const day = await london.getDay(new Date("2026-03-29T12:00:00Z"));
    expect(dayFraction(new Date("2026-03-29T00:00:00Z"), day, LONDON)).toBe(0);
    expect(dayFraction(new Date("2026-03-29T11:30:00Z"), day, LONDON)).toBe(0.5);
    expect(dayFraction(new Date("2026-03-29T23:00:00Z"), day, LONDON)).toBe(1);
  });

  // Istanbul is three hours ahead all year, so its day starts at 21:00 UTC.
  it("Should run from Istanbul's midnight for Istanbul's times", async () => {
    const day = await istanbul.getDay(new Date("2026-01-15T12:00:00Z"));
    const zone = "Europe/Istanbul";
    expect(dayFraction(new Date("2026-01-14T21:00:00Z"), day, zone)).toBe(0);
    expect(dayFraction(new Date("2026-01-15T09:00:00Z"), day, zone)).toBe(0.5);
  });

  it("Should place each point at its time of day", async () => {
    const day = await london.getDay(new Date("2026-01-15T12:00:00Z"));
    // Duhr at 12:15 GMT is 51.04% of the way through the day.
    expect(dayBand(day, LONDON)).toContain(`${skyPoints(day)[4].mid} 51.04%`);
  });
});

describe("skyProperties", () => {
  it("Should give the stylesheet the sky, its tints and where now is", async () => {
    const day = await london.getDay(new Date("2026-01-15T12:00:00Z"));
    const now = new Date("2026-01-15T12:00:00Z");
    const properties = skyProperties(now, day, "Europe/London", false);
    const sky = skyAt(now, day);
    expect(properties["--sky-top"]).toBe(sky.top);
    expect(properties["--sky-text"]).toBe("#000000");
    expect(properties["--sky-now"]).toBe("50.00%");
    expect(properties["--sky-accent-rgb"]).toMatch(/^\d+, \d+, \d+$/);
  });
});

describe("mixOklab", () => {
  it("Should return the ends unchanged", () => {
    expect(mixOklab("#123456", "#abcdef", 0)).toBe("#123456");
    expect(mixOklab("#123456", "#abcdef", 1)).toBe("#abcdef");
  });
});
