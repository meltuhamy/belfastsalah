import { describe, expect, it } from "vitest";
import { nextDays, NextDay } from "./nextDays";

const days = (entries: ReturnType<typeof nextDays>) =>
  entries.filter((e): e is NextDay => e.kind === "day");

describe("nextDays", () => {
  it("starts at today and runs seven days", () => {
    const entries = nextDays({ year: 2026, month: 2, day: 15 });
    expect(days(entries).map((d) => d.label)).toEqual([
      "Sun 15 Feb",
      "Mon 16 Feb",
      "Tue 17 Feb",
      "Wed 18 Feb",
      "Thu 19 Feb",
      "Fri 20 Feb",
      "Sat 21 Feb",
    ]);
    expect(days(entries).map((d) => d.isToday)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(entries.some((e) => e.kind === "divider")).toBe(false);
  });

  it("marks a new month with a divider", () => {
    const entries = nextDays({ year: 2026, month: 11, day: 27 });
    expect(entries.map((e) => (e.kind === "day" ? e.day : e.label))).toEqual([
      27,
      28,
      29,
      30,
      "December",
      1,
      2,
      3,
    ]);
  });

  it("keeps today first on the 31st, and names the new year", () => {
    const entries = nextDays({ year: 2026, month: 12, day: 31 });
    expect(entries[0]).toMatchObject({ kind: "day", day: 31, isToday: true });
    expect(entries[1]).toMatchObject({
      kind: "divider",
      label: "January 2027",
    });
    expect(days(entries)[6]).toMatchObject({
      year: 2027,
      month: 0,
      day: 6,
      weekday: "Wed",
    });
  });

  it("follows the calendar's own February, not the timetable file's", () => {
    // Every non-leap year's file carries a 29 February; the calendar does not.
    const entries = nextDays({ year: 2026, month: 2, day: 27 });
    expect(entries.map((e) => (e.kind === "day" ? e.label : e.label))).toEqual(
      [
        "Fri 27 Feb",
        "Sat 28 Feb",
        "March",
        "Sun 1 Mar",
        "Mon 2 Mar",
        "Tue 3 Mar",
        "Wed 4 Mar",
        "Thu 5 Mar",
      ]
    );
    expect(days(nextDays({ year: 2028, month: 2, day: 28 }))[1].day).toBe(29);
  });

  it("gives every row a key of its own", () => {
    const entries = nextDays({ year: 2026, month: 12, day: 28 });
    expect(new Set(entries.map((e) => e.key)).size).toBe(entries.length);
  });
});
