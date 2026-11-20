import { Prayer } from "./PrayerTimes";
import {
  clampOffset,
  commonReminder,
  defaultReminders,
  describeOffset,
  describeOffsetShort,
  migrateReminders,
  offsetLabel,
  PRAYER_KEYS,
  prayerKey,
  prayerOfKey,
  reminderBody,
  remindersForAll,
  soundForPrayer,
} from "./prayerReminders";
import { getDefaultSettings, migrateSettings } from "./settings";

describe("per-prayer reminders", () => {
  it("Should start every prayer, sunrise included, 5 minutes before with the phone's sound", () => {
    const { reminders } = getDefaultSettings();
    for (const key of PRAYER_KEYS) {
      expect(reminders[key]).toEqual({ on: true, offset: -5, sound: "default" });
    }
  });

  it("Should carry an upgrading user's one lead time over to every prayer", () => {
    const { reminders } = migrateSettings({ notify: true, notifyMinutes: 12 });
    for (const key of PRAYER_KEYS) {
      expect(reminders[key]).toEqual({ on: true, offset: -12, sound: "default" });
    }
  });

  it("Should carry over the first version's sound and Fajr's own sound", () => {
    const { reminders } = migrateSettings({
      notifyMinutes: 0,
      notifySound: "adhan-2",
      fajrSound: "adhan-5",
    });
    expect(reminders.fajr).toEqual({ on: true, offset: 0, sound: "adhan-5" });
    expect(reminders.isha).toEqual({ on: true, offset: 0, sound: "adhan-2" });
  });

  it("Should drop the old fields once they have been carried over", () => {
    const migrated = migrateSettings({ notifyMinutes: 10, notifySound: "silent" });
    expect(migrated).not.toHaveProperty("notifyMinutes");
    expect(migrated).not.toHaveProperty("notifySound");
    expect(migrated).not.toHaveProperty("fajrSound");
  });

  it("Should keep what was saved, and fix only what this version cannot use", () => {
    const reminders = migrateReminders({
      fajr: { on: false, offset: 12, sound: "adhan-1" },
      duhr: { on: true, offset: 99, sound: "adhan-9" },
      asr: "nonsense",
    });
    expect(reminders.fajr).toEqual({ on: false, offset: 12, sound: "adhan-1" });
    // Out of range is pulled back to the limit; an unknown sound is the default.
    expect(reminders.duhr).toEqual({ on: true, offset: 30, sound: "default" });
    expect(reminders.asr).toEqual(defaultReminders().asr);
  });

  it("Should keep offsets to whole minutes within half an hour", () => {
    expect(clampOffset(-45)).toBe(-30);
    expect(clampOffset(7.6)).toBe(8);
    expect(clampOffset(Number.NaN)).toBe(-5);
  });

  it("Should map each prayer to its key and back", () => {
    for (const key of PRAYER_KEYS) {
      expect(prayerKey(prayerOfKey(key))).toBe(key);
    }
    expect(prayerKey(Prayer.Shuruq)).toBe("shuruq");
  });

  it("Should take each prayer's sound, and the default for the end prompt", () => {
    const reminders = { ...defaultReminders(), isha: { on: true, offset: 0, sound: "adhan-4" as const } };
    expect(soundForPrayer(Prayer.Isha, reminders)).toBe("adhan-4");
    expect(soundForPrayer(Prayer.Fajr, reminders)).toBe("default");
    expect(soundForPrayer(null, reminders)).toBe("default");
  });

  it("Should say whether every prayer is set the same", () => {
    expect(commonReminder(defaultReminders())).toEqual(defaultReminders().fajr);
    expect(
      commonReminder({ ...defaultReminders(), asr: { on: false, offset: -5, sound: "default" } })
    ).toBeNull();
  });

  it("Should show All prayers what is shared, and which fields differ", () => {
    expect(remindersForAll(defaultReminders()).mixed).toEqual({
      on: false,
      offset: false,
      sound: false,
    });
    const { value, mixed } = remindersForAll({
      ...defaultReminders(),
      fajr: { on: false, offset: -5, sound: "adhan-4" },
    });
    expect(mixed).toEqual({ on: true, offset: false, sound: true });
    // On while any prayer is, so the rest of the editor stays reachable.
    expect(value).toEqual({ on: true, offset: -5, sound: "adhan-4" });
  });
});

describe("reminder wording", () => {
  it("Should describe the timing in full and in short", () => {
    expect(describeOffset(-10, "Fajr")).toBe("10 minutes before Fajr");
    expect(describeOffset(1, "Isha")).toBe("1 minute after Isha");
    expect(describeOffset(0, "Duhr")).toBe("At Duhr time");
    expect(describeOffsetShort(-5)).toBe("5 min before");
    expect(describeOffsetShort(0)).toBe("At prayer time");
    expect(describeOffsetShort(10)).toBe("10 min after");
  });

  it("Should say how far off the prayer is in the notification", () => {
    expect(reminderBody(-10)).toBe("In 10 minutes");
    expect(reminderBody(-1)).toBe("In 1 minute");
    expect(reminderBody(0)).toBe("Prayer time now");
    expect(reminderBody(15)).toBe("15 minutes ago");
  });

  it("Should label the timeline with signed minutes", () => {
    expect(offsetLabel(-10)).toBe("−10");
    expect(offsetLabel(0)).toBe("0");
    expect(offsetLabel(5)).toBe("+5");
  });
});
