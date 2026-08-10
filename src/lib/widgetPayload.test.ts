import { buildWidgetPayload, WIDGET_PAYLOAD_VERSION } from "./widgetPayload";
import { AsrMethod, PrayerLocation } from "./PrayerTimes";
import { AppSettings, getDefaultSettings } from "./settings";
import { UK_TIME_ZONE, getDeviceTimeZone, zonesAgree } from "./timeZone";

// The payload is where all the widget's thinking happens - the native side
// only binds fields to views - so this is where the widget is actually tested.
//
// Expectations come from src/prayer_data rather than from the running app, and
// the dates are in winter, when the UK is on GMT and the times on screen are
// the timetable's own strings.

function settingsWith(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...getDefaultSettings(),
    location: PrayerLocation.London,
    ...overrides,
  };
}

// london-2026.json, 15 February.
const LONDON_15_FEB = ["05:36", "07:13", "12:20", "14:45", "17:18", "18:48"];
const MORNING = new Date("2026-02-15T10:00:00Z");

describe("buildWidgetPayload", () => {
  it("Should produce nothing before a location has been chosen", async () => {
    expect(await buildWidgetPayload(null, MORNING)).toBeNull();
    expect(
      await buildWidgetPayload(settingsWith({ location: null }), MORNING)
    ).toBeNull();
  });

  it("Should carry today's six times, as printed on the timetable", async () => {
    const payload = (await buildWidgetPayload(settingsWith(), MORNING))!;

    expect(payload.version).toEqual(WIDGET_PAYLOAD_VERSION);
    expect(payload.locationLabel).toEqual("London");
    expect(payload.today.dateLabel).toEqual("Sun 15 Feb");
    expect(payload.today.prayers.map((p) => p.time)).toEqual(LONDON_15_FEB);
    expect(payload.today.prayers.map((p) => p.name)).toEqual([
      "Fajr",
      "Shuruq",
      "Duhr",
      "Asr",
      "Maghrib",
      "Isha",
    ]);
  });

  it("Should follow the location", async () => {
    const payload = (await buildWidgetPayload(
      settingsWith({ location: PrayerLocation.Belfast }),
      MORNING
    ))!;
    expect(payload.locationLabel).toEqual("Belfast");
    // belfast-2019.json, 15 February.
    expect(payload.today.prayers.map((p) => p.time)).toEqual([
      "06:01",
      "07:43",
      "12:39",
      "15:00",
      "17:33",
      "19:10",
    ]);
  });

  it("Should follow the Asr method", async () => {
    const payload = (await buildWidgetPayload(
      settingsWith({ asrMethod: AsrMethod.Hanafi }),
      MORNING
    ))!;
    expect(payload.today.prayers[3]).toEqual({ name: "Asr", time: "15:25" });
  });

  it("Should follow the clock the user reads times in", async () => {
    // The whole reason display strings are built here rather than natively:
    // the setting is applied once, by the same function the app screens use.
    const onDeviceClock = (await buildWidgetPayload(
      settingsWith({ showTimesInDeviceZone: true }),
      MORNING
    ))!;
    const onTimetableClock = (await buildWidgetPayload(
      settingsWith({ showTimesInDeviceZone: false }),
      MORNING
    ))!;

    expect(onTimetableClock.today.prayers.map((p) => p.time)).toEqual(
      LONDON_15_FEB
    );

    // Compared by offset rather than by zone name, because the suite runs
    // under five zones and in February UTC shows the same clock as London -
    // a name comparison here would call that a difference and fail.
    const shown = onDeviceClock.today.prayers.map((p) => p.time);
    if (zonesAgree(UK_TIME_ZONE, getDeviceTimeZone(), MORNING)) {
      expect(shown).toEqual(LONDON_15_FEB);
    } else {
      expect(shown).not.toEqual(LONDON_15_FEB);
    }
    // Either way the instants are identical - only the rendering differs.
    expect(onDeviceClock.upcoming[0].at).toEqual(onTimetableClock.upcoming[0].at);
  });
});

describe("the upcoming list", () => {
  it("Should start with the next prayer and run in order", async () => {
    const payload = (await buildWidgetPayload(settingsWith(), MORNING))!;

    // 10:00, so Duhr at 12:20 is next.
    expect(payload.upcoming[0].name).toEqual("Duhr");
    expect(payload.upcoming[0].time).toEqual("12:20");
    expect(new Date(payload.upcoming[0].at).toISOString()).toEqual(
      "2026-02-15T12:20:00.000Z"
    );

    const times = payload.upcoming.map((u) => u.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times.every((t) => t > MORNING.getTime())).toBe(true);
  });

  it("Should carry a display time for prayers beyond today", async () => {
    // The "show the time instead of a countdown" mode needs this when the
    // next prayer is tomorrow's, which today's rows cannot supply.
    const lateEvening = new Date("2026-02-15T20:00:00Z");
    const payload = (await buildWidgetPayload(settingsWith(), lateEvening))!;
    expect(payload.upcoming[0].name).toEqual("Fajr");
    // london-2026.json, 16 February.
    expect(payload.upcoming[0].time).toEqual("05:34");
  });

  it("Should not include prayers that have already passed today", async () => {
    // Just before Isha: only Isha should remain from today.
    const evening = new Date("2026-02-15T18:00:00Z");
    const payload = (await buildWidgetPayload(settingsWith(), evening))!;
    expect(payload.upcoming[0].name).toEqual("Isha");
    expect(payload.upcoming[1].name).toEqual("Fajr");
  });

  it("Should cross month and year boundaries", async () => {
    const payload = (await buildWidgetPayload(
      settingsWith(),
      new Date("2026-12-30T10:00:00Z"),
      7
    ))!;
    const years = new Set(
      payload.upcoming.map((u) => new Date(u.at).getUTCFullYear())
    );
    expect(years).toContain(2026);
    expect(years).toContain(2027);
  });

  it("Should cover the horizon it is asked for and stop there", async () => {
    const payload = (await buildWidgetPayload(settingsWith(), MORNING, 7))!;
    const horizonEnd = MORNING.getTime() + 7 * 24 * 60 * 60 * 1000;

    expect(payload.upcoming.every((u) => u.at <= horizonEnd)).toBe(true);
    // Six a day for a week, give or take the part-day at each end.
    expect(payload.upcoming.length).toBeGreaterThan(6 * 6);
    expect(payload.upcoming.length).toBeLessThanOrEqual(6 * 8);
  });

  it("Should stay correct across the spring clock change", async () => {
    // The UK springs forward on 2026-03-29. Instants are UTC, so the gap
    // between consecutive days' Fajr should stay near 24h, not jump by an hour.
    const payload = (await buildWidgetPayload(
      settingsWith(),
      new Date("2026-03-27T10:00:00Z"),
      5
    ))!;
    const fajrs = payload.upcoming
      .filter((u) => u.name === "Fajr")
      .map((u) => u.at);

    expect(fajrs.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < fajrs.length; i++) {
      const hours = (fajrs[i] - fajrs[i - 1]) / 3_600_000;
      expect(hours).toBeGreaterThan(22);
      expect(hours).toBeLessThan(26);
    }
  });

  it("Should keep going for a location with only one year of data", async () => {
    // Belfast ships 2019 only and is served it whatever year is asked for.
    const payload = (await buildWidgetPayload(
      settingsWith({ location: PrayerLocation.Belfast }),
      MORNING,
      30
    ))!;
    expect(payload.upcoming.length).toBeGreaterThan(6 * 29);
  });
});
