import { AsrMethod, Prayer, PrayerLocation, createPrayerTimes } from "./PrayerTimes";
import { clockNow, frameMs, jumpedTo, prayerJumps, withSpeed } from "./previewClock";

describe("previewClock", () => {
  const start = { at: Date.UTC(2026, 10, 27, 12, 0), from: 1000, speed: 1 };

  it("runs at its speed from when it was set", () => {
    expect(clockNow(start, 3000)).toBe(start.at + 2000);
    expect(clockNow({ ...start, speed: 60 }, 3000)).toBe(start.at + 120_000);
    expect(clockNow({ ...start, speed: 0 }, 3000)).toBe(start.at);
  });

  it("keeps the time it has when the speed changes", () => {
    const fast = withSpeed(start, 600, 5000);
    expect(clockNow(fast, 5000)).toBe(start.at + 4000);
    expect(clockNow(fast, 6000)).toBe(start.at + 4000 + 600_000);
  });

  it("jumps and carries on at the same speed", () => {
    const jumped = jumpedTo({ ...start, speed: 10 }, 0, 9000);
    expect(clockNow(jumped, 10_000)).toBe(10_000);
  });

  it("redraws once a second, or ten times when racing, and not at all when paused", () => {
    expect(frameMs(0)).toBeNull();
    expect(frameMs(1)).toBe(1000);
    expect(frameMs(2160)).toBe(100);
  });

  it("offers a minute before, the moment, and a minute after each adhan", async () => {
    const day = await createPrayerTimes(PrayerLocation.Istanbul, AsrMethod.Shafi).getDay(
      new Date("2026-11-27T12:00:00Z")
    );
    const jumps = prayerJumps(day);
    expect(jumps.map((j) => j.prayer)).toEqual([
      Prayer.Fajr, Prayer.Shuruq, Prayer.Duhr, Prayer.Asr, Prayer.Maghrib, Prayer.Isha,
    ]);
    const asr = jumps[Prayer.Asr];
    expect(new Date(asr.at).toISOString()).toBe("2026-11-27T12:23:00.000Z");
    expect(asr.jumps.map((j) => new Date(j.at).toISOString())).toEqual([
      "2026-11-27T12:22:00.000Z",
      "2026-11-27T12:22:58.000Z",
      "2026-11-27T12:29:00.000Z",
    ]);
    expect(jumps[Prayer.Shuruq].jumps[1].label).toBe("Sunrise");
  });
});
