import { describe, expect, it } from "vitest";
import { Prayer, PrayerTime } from "./PrayerTimes";
import { prayerNow, upcomingPrayer } from "./adhanMoment";

const at = (iso: string) => new Date(iso);
const prayer = (p: Prayer, iso: string): PrayerTime => ({ prayer: p, time: at(iso) });

const ASR = prayer(Prayer.Asr, "2026-01-15T14:02:00Z");
const MAGHRIB = prayer(Prayer.Maghrib, "2026-01-15T16:24:00Z");
const SHURUQ = prayer(Prayer.Shuruq, "2026-01-15T07:57:00Z");
const DUHR = prayer(Prayer.Duhr, "2026-01-15T12:15:00Z");

describe("prayerNow", () => {
  it("Should be the prayer that came in under five minutes ago", () => {
    expect(prayerNow(ASR, MAGHRIB, at("2026-01-15T14:02:00Z"))).toBe(ASR);
    expect(prayerNow(ASR, MAGHRIB, at("2026-01-15T14:06:59Z"))).toBe(ASR);
  });

  it("Should let go after five minutes", () => {
    expect(prayerNow(ASR, MAGHRIB, at("2026-01-15T14:07:00Z"))).toBeNull();
  });

  it("Should be nothing before the prayer comes in", () => {
    expect(prayerNow(DUHR, ASR, at("2026-01-15T14:01:59Z"))).toBeNull();
  });

  it("Should count a next prayer that has already arrived, before the app catches up", () => {
    // Asr has come in, but next is still Asr and prev still Duhr for a moment.
    expect(prayerNow(DUHR, ASR, at("2026-01-15T14:02:00Z"))).toBe(ASR);
  });

  it("Should find the prayer in the day's times at its exact second", () => {
    // Neither prev nor next is Asr at 14:02:00 itself.
    expect(prayerNow(DUHR, MAGHRIB, at("2026-01-15T14:02:00Z"), [DUHR, ASR, MAGHRIB])).toBe(ASR);
  });

  it("Should never call Shuruq a prayer time", () => {
    expect(prayerNow(SHURUQ, DUHR, at("2026-01-15T08:00:00Z"))).toBeNull();
    expect(prayerNow(prayer(Prayer.Fajr, "2026-01-15T06:20:00Z"), SHURUQ, at("2026-01-15T07:58:00Z"))).toBeNull();
  });
});

describe("upcomingPrayer", () => {
  const day = [prayer(Prayer.Fajr, "2026-01-15T06:20:00Z"), SHURUQ, DUHR, ASR, MAGHRIB, prayer(Prayer.Isha, "2026-01-15T18:01:00Z")];

  it("Should be next while next is still ahead", () => {
    expect(upcomingPrayer(MAGHRIB, day, at("2026-01-15T14:05:00Z"))).toBe(MAGHRIB);
  });

  it("Should find the next time still ahead when next has gone stale", () => {
    expect(upcomingPrayer(ASR, day, at("2026-01-15T14:02:00Z"))).toBe(MAGHRIB);
  });

  it("Should be null when nothing ahead is on hand", () => {
    expect(upcomingPrayer(null, day, at("2026-01-15T19:00:00Z"))).toBeNull();
  });
});
