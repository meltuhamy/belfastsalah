import { isDark, THEMES, themeLabels } from "./theme";
import { Prayer } from "./PrayerTimes";

const DAY = { prefersDark: false, nextPrayer: Prayer.Asr };
const NIGHT = { prefersDark: false, nextPrayer: Prayer.Fajr };

describe("isDark", () => {
  it("Should ignore everything else when set to light or dark", () => {
    for (const conditions of [
      { prefersDark: true, nextPrayer: Prayer.Fajr },
      { prefersDark: false, nextPrayer: Prayer.Asr },
    ]) {
      expect(isDark("light", conditions)).toBe(false);
      expect(isDark("dark", conditions)).toBe(true);
    }
  });

  it("Should follow the device when set to system", () => {
    expect(isDark("system", { ...DAY, prefersDark: true })).toBe(true);
    expect(isDark("system", { ...NIGHT, prefersDark: false })).toBe(false);
  });

  describe("maghrib", () => {
    // Dark from Maghrib to sunrise, which is the stretch where the prayer
    // still ahead of you is Isha, Fajr or Shuruq.
    it("Should be dark between Maghrib and sunrise", () => {
      for (const nextPrayer of [Prayer.Isha, Prayer.Fajr, Prayer.Shuruq]) {
        expect(isDark("maghrib", { prefersDark: false, nextPrayer })).toBe(true);
      }
    });

    it("Should be light between sunrise and Maghrib", () => {
      for (const nextPrayer of [Prayer.Duhr, Prayer.Asr, Prayer.Maghrib]) {
        expect(isDark("maghrib", { prefersDark: true, nextPrayer })).toBe(false);
      }
    });

    it("Should fall back to the device before the timetable loads", () => {
      expect(isDark("maghrib", { prefersDark: true, nextPrayer: null })).toBe(
        true
      );
      expect(isDark("maghrib", { prefersDark: false, nextPrayer: null })).toBe(
        false
      );
    });
  });
});

describe("theme options", () => {
  it("Should offer the standard three first, then this app's own", () => {
    expect(THEMES).toEqual(["system", "light", "dark", "maghrib"]);
  });

  it("Should label every option it offers", () => {
    for (const theme of THEMES) {
      expect(themeLabels[theme]).toBeTruthy();
    }
  });
});
