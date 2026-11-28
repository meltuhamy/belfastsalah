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
    expect(migrated.reminders.fajr.offset).toEqual(-10);
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
      migrateSettings(legacyStored({ nightMode: true, nightModeMaghrib: true }))
        .theme
    ).toEqual("sky");
  });

  it("Should move Dark after Maghrib, which is gone, to Sky", () => {
    const stored = { ...getDefaultSettings(), theme: "maghrib" };
    expect(migrateSettings(stored).theme).toEqual("sky");
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
    // System follows the phone's switch, which is the least surprising
    // default for someone who never saw the setting.
    expect(migrated.timeFormat).toEqual("system");
    // The screen sleeping as usual is what the phone did before the toggle.
    expect(migrated.keepAwake).toBe(false);
  });

  it("Should keep a time format that was already chosen", () => {
    const migrated = migrateSettings(legacyStored({ timeFormat: "12" }));
    expect(migrated.timeFormat).toEqual("12");
  });

  it("Should leave already-current settings alone", () => {
    const current = { ...getDefaultSettings(), theme: "dark" as const };
    expect(migrateSettings(current)).toEqual(current);
  });

  it("Should default a theme it has no way to infer", () => {
    // No nightMode at all: either a fresh blob or one already migrated.
    const { nightMode: _nightMode, ...noTheme } = legacyStored();
    expect(migrateSettings(noTheme).theme).toEqual("system");
  });

  it("Should give a new install the Sky V2 theme", () => {
    expect(getDefaultSettings().theme).toEqual("skyV2");
  });

  it("Should keep the Sky theme for someone who chose it", () => {
    expect(migrateSettings({ theme: "sky" }).theme).toEqual("sky");
  });
});
