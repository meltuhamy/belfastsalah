import {
  zoneChoiceApplies,
  resolveDisplayTimeZone,
  showsForeignZone,
  shouldPromptForZone,
} from "./displayZone";
import { PrayerLocation } from "./PrayerTimeData";
import { AppSettings, getDefaultSettings } from "./settings";
import { UK_TIME_ZONE } from "./timeZone";

const SUMMER = new Date("2026-07-15T12:00:00Z");
const WINTER = new Date("2026-01-15T12:00:00Z");

function settingsWith(overrides: Partial<AppSettings>): AppSettings {
  return {
    ...getDefaultSettings(),
    location: PrayerLocation.London,
    ...overrides,
  };
}

describe("zoneChoiceApplies", () => {
  it("Should be false when the device shares the timetable's clock", () => {
    expect(
      zoneChoiceApplies(PrayerLocation.London, SUMMER, UK_TIME_ZONE)
    ).toBe(false);
    // Dublin is a different zone by name but never by clock, so there is
    // nothing to offer someone there.
    expect(
      zoneChoiceApplies(PrayerLocation.London, SUMMER, "Europe/Dublin")
    ).toBe(false);
  });

  it("Should be true when the device is on a genuinely different clock", () => {
    expect(zoneChoiceApplies(PrayerLocation.London, SUMMER, "Asia/Dubai")).toBe(
      true
    );
    expect(
      zoneChoiceApplies(PrayerLocation.Belfast, SUMMER, "America/New_York")
    ).toBe(true);
  });

  it("Should follow the seasons for a zone that only sometimes agrees", () => {
    // UTC matches the UK in winter but not during British Summer Time.
    expect(zoneChoiceApplies(PrayerLocation.London, WINTER, "UTC")).toBe(false);
    expect(zoneChoiceApplies(PrayerLocation.London, SUMMER, "UTC")).toBe(true);
  });

  it("Should be false before a location has been chosen", () => {
    expect(zoneChoiceApplies(null, SUMMER, "Asia/Dubai")).toBe(false);
  });
});

describe("resolveDisplayTimeZone", () => {
  it("Should default to the timetable's own zone", () => {
    expect(
      resolveDisplayTimeZone(
        settingsWith({ showTimesInDeviceZone: false }),
        "Asia/Dubai"
      )
    ).toEqual(UK_TIME_ZONE);
  });

  it("Should use the device's zone once switched", () => {
    expect(
      resolveDisplayTimeZone(
        settingsWith({ showTimesInDeviceZone: true }),
        "Asia/Dubai"
      )
    ).toEqual("Asia/Dubai");
  });

  it("Should fall back to the UK before settings exist", () => {
    expect(resolveDisplayTimeZone(null, "Asia/Dubai")).toEqual(UK_TIME_ZONE);
    expect(
      resolveDisplayTimeZone(settingsWith({ location: null }), "Asia/Dubai")
    ).toEqual(UK_TIME_ZONE);
  });
});

describe("showsForeignZone", () => {
  it("Should label the times when they are not the device's own clock", () => {
    expect(
      showsForeignZone(
        settingsWith({ showTimesInDeviceZone: false }),
        SUMMER,
        "Asia/Dubai"
      )
    ).toBe(true);
  });

  it("Should say nothing once the user reads times on their own clock", () => {
    expect(
      showsForeignZone(
        settingsWith({ showTimesInDeviceZone: true }),
        SUMMER,
        "Asia/Dubai"
      )
    ).toBe(false);
  });

  it("Should say nothing when the clocks agree anyway", () => {
    expect(
      showsForeignZone(
        settingsWith({ showTimesInDeviceZone: false }),
        SUMMER,
        "Europe/Dublin"
      )
    ).toBe(false);
  });
});

describe("shouldPromptForZone", () => {
  it("Should prompt someone on a different clock who has not been asked", () => {
    expect(
      shouldPromptForZone(
        settingsWith({ timeZoneNoticeSeen: false }),
        SUMMER,
        "Asia/Dubai"
      )
    ).toBe(true);
  });

  it("Should not prompt twice", () => {
    expect(
      shouldPromptForZone(
        settingsWith({ timeZoneNoticeSeen: true }),
        SUMMER,
        "Asia/Dubai"
      )
    ).toBe(false);
  });

  it("Should not prompt when there is nothing to choose between", () => {
    expect(
      shouldPromptForZone(
        settingsWith({ timeZoneNoticeSeen: false }),
        SUMMER,
        UK_TIME_ZONE
      )
    ).toBe(false);
  });

  it("Should treat keeping timetable time as an answer, not a deferral", () => {
    // Keeping the timetable's clock is an answer, not a deferral: the notice
    // must not come back for it. Guards the pairing of the two flags, which
    // are easy to set independently by mistake.
    const answered = settingsWith({
      showTimesInDeviceZone: false,
      timeZoneNoticeSeen: true,
    });
    expect(shouldPromptForZone(answered, SUMMER, "Asia/Dubai")).toBe(false);
    // ...while the row in settings stays available to change their mind.
    expect(zoneChoiceApplies(answered.location, SUMMER, "Asia/Dubai")).toBe(
      true
    );
  });

  it("Should not prompt before settings exist", () => {
    expect(shouldPromptForZone(null, SUMMER, "Asia/Dubai")).toBe(false);
  });
});
