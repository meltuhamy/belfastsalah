import { formatClockTime, uses24Hour } from "./timeFormat";

// Winter dates, so the UK is on GMT and the expected strings are the
// timetable's own. The point of the setting is that the instant does not
// change - only how the clock on screen is written.

const WINTER = new Date("2026-11-16T11:50:00Z");
const JUST_AFTER_MIDNIGHT = new Date("2026-11-16T00:16:00Z");

describe("uses24Hour", () => {
  it("Should let an explicit choice override the device", () => {
    expect(uses24Hour("12", true)).toBe(false);
    expect(uses24Hour("24", false)).toBe(true);
  });

  it("Should follow the device on System", () => {
    expect(uses24Hour("system", true)).toBe(true);
    expect(uses24Hour("system", false)).toBe(false);
  });
});

describe("formatClockTime", () => {
  it("Should write a 24-hour clock without AM or PM", () => {
    expect(formatClockTime(WINTER, "Europe/London", true)).toEqual("11:50");
    expect(formatClockTime(JUST_AFTER_MIDNIGHT, "Europe/London", true)).toEqual(
      "00:16"
    );
  });

  it("Should write a 12-hour clock without AM or PM", () => {
    expect(formatClockTime(WINTER, "Europe/London", false)).toEqual("11:50");
    expect(formatClockTime(JUST_AFTER_MIDNIGHT, "Europe/London", false)).toEqual(
      "12:16"
    );
    // No leading zero, unlike the 24-hour clock.
    expect(
      formatClockTime(new Date("2026-11-16T06:05:00Z"), "Europe/London", false)
    ).toEqual("6:05");
  });

  it("Should add AM or PM to a 12-hour clock only when asked", () => {
    const withPeriod = { withPeriod: true };
    expect(formatClockTime(WINTER, "Europe/London", false, withPeriod)).toMatch(
      /^11:50\s(AM)$/
    );
    expect(
      formatClockTime(JUST_AFTER_MIDNIGHT, "Europe/London", false, withPeriod)
    ).toMatch(/^12:16\s(AM)$/);
    // Never on the 24-hour clock.
    expect(formatClockTime(WINTER, "Europe/London", true, withPeriod)).toEqual(
      "11:50"
    );
  });

  it("Should keep the instant and change only the clock", () => {
    // The same moment in a zone four hours ahead: 15:50 there.
    expect(formatClockTime(WINTER, "Asia/Dubai", true)).toEqual("15:50");
    expect(formatClockTime(WINTER, "Asia/Dubai", false)).toEqual("3:50");
  });
});
