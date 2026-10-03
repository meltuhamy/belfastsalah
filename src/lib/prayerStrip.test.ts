import { nextIsAfterDay, isLaterDay } from "./prayerStrip";
import {
  createPrayerTimes,
  AsrMethod,
  Prayer,
  PrayerDayTimes,
  PrayerLocation,
} from "./PrayerTimes";
import { UK_TIME_ZONE } from "./timeZone";

// 15 February 2026 in London: Fajr 05:36 ... Isha 18:48, all GMT. Read out of
// src/prayer_data/london-2026.json.
const london = createPrayerTimes(PrayerLocation.London, AsrMethod.Shafi);
const FEB_15 = new Date("2026-02-15T12:00:00Z");

let day: PrayerDayTimes;

beforeAll(async () => {
  day = await london.getDay(FEB_15);
});

describe("nextIsAfterDay", () => {
  it("Should be false while a prayer of the day is still to come", async () => {
    const next = await london.getNext(new Date("2026-02-15T10:00:00Z"));
    expect(next.prayer).toBe(Prayer.Duhr);
    expect(nextIsAfterDay(day, next)).toBe(false);
  });

  it("Should be false during the day's last prayer window", async () => {
    // 18:00 is after Maghrib and before Isha, so Isha is still today's.
    const next = await london.getNext(new Date("2026-02-15T18:00:00Z"));
    expect(next.prayer).toBe(Prayer.Isha);
    expect(nextIsAfterDay(day, next)).toBe(false);
  });

  it("Should be true once the last prayer has passed", async () => {
    const next = await london.getNext(new Date("2026-02-15T20:00:00Z"));
    expect(next.prayer).toBe(Prayer.Fajr);
    expect(nextIsAfterDay(day, next)).toBe(true);
  });

  it("Should be false before anything has loaded", () => {
    expect(nextIsAfterDay(null, day[Prayer.Fajr])).toBe(false);
    expect(nextIsAfterDay(day, null)).toBe(false);
  });
});

describe("isLaterDay", () => {
  const noon = new Date("2026-02-15T12:00:00Z");

  it("Should be false for an instant on the same day", () => {
    expect(
      isLaterDay(new Date("2026-02-15T23:00:00Z"), noon, UK_TIME_ZONE)
    ).toBe(false);
  });

  it("Should be true for an instant on the following day", () => {
    expect(
      isLaterDay(new Date("2026-02-16T05:00:00Z"), noon, UK_TIME_ZONE)
    ).toBe(true);
  });

  it("Should be false looking backwards", () => {
    expect(
      isLaterDay(new Date("2026-02-14T23:00:00Z"), noon, UK_TIME_ZONE)
    ).toBe(false);
  });

  it("Should be false when the reader's own zone is already on that day", () => {
    // 23:30 in London on the 15th is 03:30 in Dubai on the 16th, so tomorrow's
    // London times are not tomorrow's times to someone reading them in Dubai.
    const lateInLondon = new Date("2026-02-15T23:30:00Z");
    const tomorrowsFajr = new Date("2026-02-16T05:34:00Z");
    expect(isLaterDay(tomorrowsFajr, lateInLondon, "Asia/Dubai")).toBe(false);
    expect(isLaterDay(tomorrowsFajr, lateInLondon, UK_TIME_ZONE)).toBe(true);
  });

  it("Should compare dates rather than elapsed hours", () => {
    // Half an hour apart, but across midnight.
    expect(
      isLaterDay(
        new Date("2026-02-16T00:15:00Z"),
        new Date("2026-02-15T23:45:00Z"),
        UK_TIME_ZONE
      )
    ).toBe(true);
  });
});
