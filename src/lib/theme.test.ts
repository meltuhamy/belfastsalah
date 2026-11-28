import { isDark, isSkyTheme, THEMES, themeLabels } from "./theme";
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
});

describe("Sky V2", () => {
  it("is dark and light on Sky's rule", () => {
    for (const nextPrayer of [Prayer.Fajr, Prayer.Duhr, Prayer.Isha, null]) {
      for (const prefersDark of [false, true]) {
        expect(isDark("skyV2", { prefersDark, nextPrayer })).toBe(
          isDark("sky", { prefersDark, nextPrayer })
        );
      }
    }
  });

  it("tints the app from the sky, as Sky does", () => {
    expect(isSkyTheme("skyV2")).toBe(true);
    expect(isSkyTheme("sky")).toBe(true);
    expect(isSkyTheme("dark")).toBe(false);
  });
});

describe("sky", () => {
  // Its colours change all day, but it goes dark from Maghrib to sunrise, so
  // its night agrees with the timetable's - which is what "Dark after
  // Maghrib" did before Sky replaced it.
  it("Should be dark between Maghrib and sunrise, and light otherwise", () => {
    for (const nextPrayer of [Prayer.Isha, Prayer.Fajr, Prayer.Shuruq]) {
      expect(isDark("sky", { prefersDark: false, nextPrayer })).toBe(true);
    }
    for (const nextPrayer of [Prayer.Duhr, Prayer.Asr, Prayer.Maghrib]) {
      expect(isDark("sky", { prefersDark: true, nextPrayer })).toBe(false);
    }
  });

  it("Should fall back to the device before it has a day to follow", () => {
    expect(isDark("sky", { prefersDark: true, nextPrayer: null })).toBe(true);
    expect(isDark("sky", { prefersDark: false, nextPrayer: null })).toBe(false);
  });
});

describe("theme options", () => {
  it("Should offer the standard three first, then this app's own", () => {
    expect(THEMES).toEqual(["system", "light", "dark", "sky", "skyV2"]);
  });

  it("Should label every option it offers", () => {
    for (const theme of THEMES) {
      expect(themeLabels[theme]).toBeTruthy();
    }
  });
});
