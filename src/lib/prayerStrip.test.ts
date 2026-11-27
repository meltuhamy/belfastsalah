import {
  stripCells,
  stripIndexOf,
  stripOffset,
  stripPhase,
  stripProgress,
  timelineLines,
} from "./prayerStrip";
import {
  createPrayerTimes,
  AsrMethod,
  Prayer,
  PrayerDayTimes,
  PrayerLocation,
} from "./PrayerTimes";
import { prayerNow, upcomingPrayer } from "./adhanMoment";

// 15 and 16 February 2026 in London, all GMT, out of
// src/prayer_data/london-2026.json.
const london = createPrayerTimes(PrayerLocation.London, AsrMethod.Shafi);

let feb15: PrayerDayTimes;
let feb16: PrayerDayTimes;

beforeAll(async () => {
  feb15 = await london.getDay(new Date("2026-02-15T12:00:00Z"));
  feb16 = await london.getDay(new Date("2026-02-16T12:00:00Z"));
});

const minutes = (n: number) => n * 60 * 1000;

/** The phase at `now`, worked out the way the day card does. */
async function phaseAt(iso: string, today: () => PrayerDayTimes) {
  const now = new Date(iso);
  const [prev, next] = await Promise.all([
    london.getPrev(now),
    london.getNext(now),
  ]);
  const current = prayerNow(prev, next, now, today());
  return stripPhase(current, upcomingPrayer(next, today(), now));
}

describe("stripPhase", () => {
  it("is the day while a prayer of the day is still to come", async () => {
    expect((await phaseAt("2026-02-15T10:00:00Z", () => feb15)).kind).toBe(
      "day"
    );
  });

  it("stays the day through Isha's adhan moment", async () => {
    const isha = feb15[Prayer.Isha].time.getTime();
    const iso = new Date(isha + minutes(4)).toISOString();
    expect((await phaseAt(iso, () => feb15)).kind).toBe("day");
  });

  it("is the night once Isha's moment is over, waiting for the next Fajr", async () => {
    const isha = feb15[Prayer.Isha].time.getTime();
    const iso = new Date(isha + minutes(5)).toISOString();
    const phase = await phaseAt(iso, () => feb15);
    expect(phase).toEqual({ kind: "night", fajr: feb16[Prayer.Fajr] });
  });

  it("is the same night after midnight", async () => {
    const phase = await phaseAt("2026-02-16T03:00:00Z", () => feb16);
    expect(phase).toEqual({ kind: "night", fajr: feb16[Prayer.Fajr] });
  });

  it("is Fajr for Fajr's adhan moment, then the day", async () => {
    const fajr = feb16[Prayer.Fajr].time.getTime();
    expect(await phaseAt(new Date(fajr).toISOString(), () => feb16)).toEqual({
      kind: "fajr",
      fajr: feb16[Prayer.Fajr],
    });
    expect(
      (await phaseAt(new Date(fajr + minutes(5)).toISOString(), () => feb16))
        .kind
    ).toBe("day");
  });
});

describe("stripOffset", () => {
  it("slides one column for the night and six for Fajr", () => {
    expect(stripOffset({ kind: "day" })).toBe(0);
    expect(stripOffset({ kind: "night", fajr: feb16[Prayer.Fajr] })).toBe(1);
    expect(stripOffset({ kind: "fajr", fajr: feb16[Prayer.Fajr] })).toBe(6);
  });
});

describe("stripIndexOf", () => {
  it("tells the two Fajrs apart by their instants", () => {
    const cells = stripCells({ days: [feb15, feb16], offset: 1 });
    expect(stripIndexOf(cells, feb15[Prayer.Fajr])).toBe(0);
    expect(stripIndexOf(cells, feb16[Prayer.Fajr])).toBe(6);
    expect(stripIndexOf(cells, null)).toBe(-1);
  });
});

describe("stripProgress", () => {
  it("is null before the first time", () => {
    const cells = stripCells({ days: [feb15], offset: 0 });
    const before = new Date(feb15[Prayer.Fajr].time.getTime() - 1000);
    expect(stripProgress(cells, before)).toEqual({
      progress: null,
      lastPassed: -1,
    });
  });

  it("runs on past Isha into the next day's Fajr", () => {
    const cells = stripCells({ days: [feb15, feb16], offset: 1 });
    const isha = feb15[Prayer.Isha].time.getTime();
    const fajr = feb16[Prayer.Fajr].time.getTime();
    const { progress, lastPassed } = stripProgress(
      cells,
      new Date((isha + fajr) / 2)
    );
    expect(lastPassed).toBe(5);
    expect(progress).toBeCloseTo(5.5);
  });

  it("leaves the line at Asr's dot while its adhan is being called", () => {
    const cells = stripCells({ days: [feb15], offset: 0 });
    const asr = feb15[Prayer.Asr].time.getTime();
    const maghrib = feb15[Prayer.Maghrib].time.getTime();
    const { progress, lastPassed } = stripProgress(
      cells,
      new Date(asr + minutes(4))
    );
    expect(lastPassed).toBe(Prayer.Asr);
    expect(progress).toBeCloseTo(
      Prayer.Asr + minutes(4) / (maghrib - asr),
      5
    );
  });

  it("holds the line a little past Asr's dot once its adhan ends", () => {
    const cells = stripCells({ days: [feb15], offset: 0 });
    const asr = feb15[Prayer.Asr].time.getTime();
    const { progress, lastPassed } = stripProgress(
      cells,
      new Date(asr + minutes(5) + 1000)
    );
    expect(lastPassed).toBe(Prayer.Asr);
    expect(progress).toBeCloseTo(Prayer.Asr + 0.3, 5);
    // Never as far as the next prayer's dot.
    expect(progress).toBeLessThan(Prayer.Maghrib);
  });

  it("returns to real progress once it has passed the extra bit", () => {
    const cells = stripCells({ days: [feb15], offset: 0 });
    const asr = feb15[Prayer.Asr].time.getTime();
    const maghrib = feb15[Prayer.Maghrib].time.getTime();
    const { progress, lastPassed } = stripProgress(
      cells,
      new Date(asr + minutes(120))
    );
    expect(lastPassed).toBe(Prayer.Asr);
    expect(progress).toBeCloseTo(
      Prayer.Asr + minutes(120) / (maghrib - asr),
      5
    );
  });

  it("stops at the last time on hand, even after its adhan", () => {
    const cells = stripCells({ days: [feb15], offset: 0 });
    const isha = feb15[Prayer.Isha].time.getTime();
    expect(stripProgress(cells, new Date(isha + minutes(6)))).toEqual({
      progress: Prayer.Isha,
      lastPassed: Prayer.Isha,
    });
    expect(stripProgress(cells, new Date(isha + minutes(30)))).toEqual({
      progress: Prayer.Isha,
      lastPassed: Prayer.Isha,
    });
  });
});

describe("timelineLines", () => {
  it("draws the day's line from Fajr as far as now", () => {
    expect(timelineLines(1, 2.5, 2, 0)).toEqual([
      { from: 0, length: 2.5, solid: 0.8, gone: false },
    ]);
  });

  it("draws nothing before Fajr", () => {
    expect(timelineLines(1, null, -1, 0)).toEqual([null]);
  });

  it("carries the evening's line on towards the next Fajr overnight", () => {
    expect(timelineLines(2, 5.5, 5, 1)).toEqual([
      { from: 0, length: 5.5, solid: 5 / 5.5, gone: false },
      null,
    ]);
  });

  it("sends the evening's line away at Fajr, and starts the new day's", () => {
    expect(timelineLines(2, 6, 6, 6)).toEqual([
      { from: 0, length: 6, solid: 1, gone: true },
      { from: 6, length: 0, solid: 1, gone: false },
    ]);
  });
});
