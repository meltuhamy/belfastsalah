import { describeAppearance } from "./reminderAppearance";

const withImportance = (importance?: number) => ({
  enabled: true,
  channels: { fajr: { id: "prayer-fajr-1", importance } },
});

describe("describeAppearance", () => {
  it("names each of Android's importance levels", () => {
    expect(describeAppearance(withImportance(0), "fajr")).toBe("Off in Android settings");
    expect(describeAppearance(withImportance(1), "fajr")).toBe("No sound, minimised");
    expect(describeAppearance(withImportance(2), "fajr")).toBe("No sound or pop-up");
    expect(describeAppearance(withImportance(3), "fajr")).toBe("Sound, no pop-up");
    expect(describeAppearance(withImportance(4), "fajr")).toBe("Sound and pop-up");
    expect(describeAppearance(withImportance(5), "fajr")).toBe("Sound and pop-up");
  });

  it("says when the whole app is off, whatever the channel", () => {
    expect(
      describeAppearance({ ...withImportance(4), enabled: false }, "fajr")
    ).toBe("Notifications are off for this app");
  });

  it("says nothing without a channel", () => {
    expect(describeAppearance(null, "fajr")).toBeNull();
    expect(describeAppearance(withImportance(), "fajr")).toBeNull();
    expect(describeAppearance({ enabled: true, channels: {} }, "isha")).toBeNull();
  });
});
