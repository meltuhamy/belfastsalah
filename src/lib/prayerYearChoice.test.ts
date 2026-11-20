import { chooseYear } from "./PrayerTimeData";

const londonFiles = [2022, 2023, 2024, 2025, 2026];

describe("Choosing which year to serve", () => {
  it("Should serve a London file for its own year", () => {
    expect(chooseYear(2026, londonFiles, true)).toEqual({ year: 2026, calculated: false });
  });

  it("Should calculate London years after its files", () => {
    expect(chooseYear(2027, londonFiles, true)).toEqual({ year: 2027, calculated: true });
    expect(chooseYear(2099, londonFiles, true)).toEqual({ year: 2099, calculated: true });
  });

  it("Should not let a later file stand in for the years before it", () => {
    // Regression: the nearest file above used to win, so a london-2030.json
    // would have served 2030's rows, clock changes and all, in 2027.
    const withLaterFile = [...londonFiles, 2030];
    expect(chooseYear(2027, withLaterFile, true)).toEqual({ year: 2027, calculated: true });
    expect(chooseYear(2030, withLaterFile, true)).toEqual({ year: 2030, calculated: false });
    expect(chooseYear(2031, withLaterFile, true)).toEqual({ year: 2031, calculated: true });
  });

  it("Should still clamp a year before the first file to the first file", () => {
    expect(chooseYear(2019, londonFiles, true)).toEqual({ year: 2022, calculated: false });
  });

  it("Should give a location that cannot be calculated its nearest file", () => {
    expect(chooseYear(2030, [2019], false)).toEqual({ year: 2019, calculated: false });
    expect(chooseYear(2018, [2019], false)).toEqual({ year: 2019, calculated: false });
  });

  it("Should calculate every year for a location with no files at all", () => {
    // Istanbul: calculated from its first day, with nothing to clamp to.
    expect(chooseYear(2026, [], true)).toEqual({ year: 2026, calculated: true });
    expect(chooseYear(2099, [], true)).toEqual({ year: 2099, calculated: true });
  });
});
