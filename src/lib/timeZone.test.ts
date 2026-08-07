import {
  UK_TIME_ZONE,
  getZonedDateParts,
  getZoneOffsetMinutes,
  zonesAgree,
  shiftZonedDay,
  formatTimeInZone,
  formatDateInZone,
} from "./timeZone";

describe("getZonedDateParts", () => {
  it("Should read the calendar date as the zone sees it", () => {
    // 23:30 UTC on 5 Aug is already 03:30 on 6 Aug in Dubai.
    const instant = new Date("2026-08-05T23:30:00Z");
    expect(getZonedDateParts(instant, UK_TIME_ZONE)).toEqual({
      year: 2026,
      month: 8,
      day: 6, // 00:30 BST
    });
    expect(getZonedDateParts(instant, "Asia/Dubai")).toEqual({
      year: 2026,
      month: 8,
      day: 6,
    });
    expect(getZonedDateParts(instant, "America/Los_Angeles")).toEqual({
      year: 2026,
      month: 8,
      day: 5,
    });
  });

  it("Should roll the year over per zone", () => {
    // Midnight UTC on new year is still 31 Dec in Los Angeles.
    const instant = new Date("2026-01-01T00:30:00Z");
    expect(getZonedDateParts(instant, UK_TIME_ZONE).year).toEqual(2026);
    expect(getZonedDateParts(instant, "America/Los_Angeles")).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    });
  });
});

describe("getZoneOffsetMinutes", () => {
  it("Should report GMT in winter and BST in summer", () => {
    expect(
      getZoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), UK_TIME_ZONE)
    ).toEqual(0);
    expect(
      getZoneOffsetMinutes(new Date("2026-07-15T12:00:00Z"), UK_TIME_ZONE)
    ).toEqual(60);
  });

  it("Should handle zones behind UTC and on half hours", () => {
    expect(
      getZoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "America/New_York")
    ).toEqual(-300);
    expect(
      getZoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "Asia/Kolkata")
    ).toEqual(330);
  });
});

describe("zonesAgree", () => {
  it("Should treat zones showing the same clock as agreeing", () => {
    // Dublin and London differ by name but never by clock.
    const summer = new Date("2026-07-15T12:00:00Z");
    expect(zonesAgree(UK_TIME_ZONE, "Europe/Dublin", summer)).toBe(true);
    expect(zonesAgree(UK_TIME_ZONE, "Europe/Lisbon", summer)).toBe(true);
  });

  it("Should spot a genuine difference", () => {
    const summer = new Date("2026-07-15T12:00:00Z");
    expect(zonesAgree(UK_TIME_ZONE, "Asia/Dubai", summer)).toBe(false);
    // Paris is one hour ahead of London all year.
    expect(zonesAgree(UK_TIME_ZONE, "Europe/Paris", summer)).toBe(false);
  });

  it("Should notice zones that only agree part of the year", () => {
    // UTC matches London in winter but not during British Summer Time.
    expect(zonesAgree(UK_TIME_ZONE, "UTC", new Date("2026-01-15T12:00:00Z"))).toBe(
      true
    );
    expect(zonesAgree(UK_TIME_ZONE, "UTC", new Date("2026-07-15T12:00:00Z"))).toBe(
      false
    );
  });
});

describe("shiftZonedDay", () => {
  it("Should step to the next and previous calendar day", () => {
    const instant = new Date("2026-08-05T18:00:00Z");
    expect(getZonedDateParts(shiftZonedDay(instant, UK_TIME_ZONE, 1), UK_TIME_ZONE))
      .toEqual({ year: 2026, month: 8, day: 6 });
    expect(getZonedDateParts(shiftZonedDay(instant, UK_TIME_ZONE, -1), UK_TIME_ZONE))
      .toEqual({ year: 2026, month: 8, day: 4 });
  });

  it("Should step exactly one day across the spring clock change", () => {
    // The UK springs forward on 2026-03-29, losing an hour overnight. This
    // instant is 23:30 on the 28th in London, so one day on is the 29th.
    const nightBefore = new Date("2026-03-28T23:30:00Z");
    expect(
      getZonedDateParts(shiftZonedDay(nightBefore, UK_TIME_ZONE, 1), UK_TIME_ZONE)
    ).toEqual({ year: 2026, month: 3, day: 29 });

    // Adding a flat 24 hours instead lands on the 30th, skipping a day - the
    // reason this helper exists rather than date-fns addDays.
    const naive = new Date(nightBefore.getTime() + 24 * 60 * 60 * 1000);
    expect(getZonedDateParts(naive, UK_TIME_ZONE).day).toEqual(30);
  });

  it("Should step exactly one day across the autumn clock change", () => {
    // The UK falls back on 2026-10-25, gaining an hour. 23:30 UTC on the 24th
    // is 00:30 BST on the 25th, and one day on is the 26th.
    const earlyHours = new Date("2026-10-24T23:30:00Z");
    expect(
      getZonedDateParts(shiftZonedDay(earlyHours, UK_TIME_ZONE, 1), UK_TIME_ZONE)
    ).toEqual({ year: 2026, month: 10, day: 26 });

    // A flat 24 hours stays on the 25th here, repeating a day rather than
    // skipping one.
    const naive = new Date(earlyHours.getTime() + 24 * 60 * 60 * 1000);
    expect(getZonedDateParts(naive, UK_TIME_ZONE).day).toEqual(25);
  });

  it("Should roll over month and year boundaries", () => {
    const newYearsEve = new Date("2026-12-31T18:00:00Z");
    expect(
      getZonedDateParts(shiftZonedDay(newYearsEve, UK_TIME_ZONE, 1), UK_TIME_ZONE)
    ).toEqual({ year: 2027, month: 1, day: 1 });
  });
});

describe("formatTimeInZone", () => {
  it("Should render the clock the zone shows, not the device's", () => {
    // 02:47 UTC in August is 03:47 in London and 06:47 in Dubai.
    const fajr = new Date("2026-08-05T02:47:00Z");
    expect(formatTimeInZone(fajr, UK_TIME_ZONE)).toEqual("03:47");
    expect(formatTimeInZone(fajr, "Asia/Dubai")).toEqual("06:47");
    expect(formatTimeInZone(fajr, "UTC")).toEqual("02:47");
  });

  it("Should use a 24 hour clock including midnight", () => {
    expect(formatTimeInZone(new Date("2026-01-15T00:05:00Z"), "UTC")).toEqual(
      "00:05"
    );
    expect(formatTimeInZone(new Date("2026-01-15T13:05:00Z"), "UTC")).toEqual(
      "13:05"
    );
  });
});

describe("formatDateInZone", () => {
  it("Should render the date the zone is on", () => {
    const instant = new Date("2026-08-05T23:30:00Z");
    expect(formatDateInZone(instant, UK_TIME_ZONE)).toEqual("Thu 6 Aug");
    expect(formatDateInZone(instant, "America/Los_Angeles")).toEqual("Wed 5 Aug");
  });
});
