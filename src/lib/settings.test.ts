import { migrateSettings, getDefaultSettings } from "./settings";
import { AsrMethod, PrayerLocation } from "./PrayerTimes";

// Settings written by an older version of the app, before the theme rewrite.
function legacyStored(overrides: Record<string, unknown> = {}) {
  return {
    notify: true,
    notifyMinutes: 10,
    asrMethod: AsrMethod.Hanafi,
    nightMode: false,
    nightModeMaghrib: false,
    location: PrayerLocation.Belfast,
    ...overrides,
  };
}

describe("migrateSettings", () => {
  it("Should keep what an upgrading user already chose", () => {
    const migrated = migrateSettings(legacyStored());
    expect(migrated.notify).toBe(true);
    expect(migrated.notifyMinutes).toEqual(10);
    expect(migrated.asrMethod).toEqual(AsrMethod.Hanafi);
    expect(migrated.location).toEqual(PrayerLocation.Belfast);
  });

  it("Should map the old dark-mode booleans onto the theme they produced", () => {
    // Upgrading must look like nothing happened, so an explicit "off" becomes
    // light rather than system - even though its initial value came from the
    // device, the user could have turned it off deliberately.
    expect(migrateSettings(legacyStored({ nightMode: false })).theme).toEqual(
      "light"
    );
    expect(migrateSettings(legacyStored({ nightMode: true })).theme).toEqual(
      "dark"
    );
    expect(
      migrateSettings(
        legacyStored({ nightMode: true, nightModeMaghrib: true })
      ).theme
    ).toEqual("maghrib");
  });

  it("Should ignore the maghrib flag when dark mode was off", () => {
    // The old pair was coupled: the second only meant anything with the first
    // on, and the screen hid it otherwise, so a stale true must not resurface.
    expect(
      migrateSettings(
        legacyStored({ nightMode: false, nightModeMaghrib: true })
      ).theme
    ).toEqual("light");
  });

  it("Should drop the old fields rather than carry them forever", () => {
    const migrated = migrateSettings(legacyStored({ nightMode: true }));
    expect(migrated).not.toHaveProperty("nightMode");
    expect(migrated).not.toHaveProperty("nightModeMaghrib");
  });

  it("Should default fields added since the blob was written", () => {
    const migrated = migrateSettings(legacyStored());
    expect(migrated.showTimesInDeviceZone).toBe(false);
    expect(migrated.timeZoneNoticeSeen).toBe(false);
  });

  it("Should leave already-current settings alone", () => {
    const current = { ...getDefaultSettings(), theme: "maghrib" as const };
    expect(migrateSettings(current)).toEqual(current);
  });

  it("Should default a theme it has no way to infer", () => {
    // No nightMode at all: either a fresh blob or one already migrated.
    const { nightMode: _nightMode, ...noTheme } = legacyStored();
    expect(migrateSettings(noTheme).theme).toEqual("system");
  });
});
