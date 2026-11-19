import { existsSync } from "node:fs";
import { join } from "node:path";
import { Prayer } from "./PrayerTimes";
import {
  androidChannelId,
  iosSoundName,
  isFajrSound,
  isReminderSound,
  previewUrl,
  REMINDER_SOUNDS,
  reminderSoundLabels,
  soundForPrayer,
} from "./reminderSound";
import { getDefaultSettings, migrateSettings } from "./settings";

describe("reminder sounds", () => {
  it("Should show the adhans by number only", () => {
    expect(REMINDER_SOUNDS.map((sound) => reminderSoundLabels[sound])).toEqual([
      "Default sound",
      "Silent",
      "Adhan 1",
      "Adhan 2",
      "Adhan 3",
      "Adhan 4",
      "Adhan 5",
    ]);
  });

  it("Should give a new install the default sound, with Fajr following it", () => {
    const settings = getDefaultSettings();
    expect(settings.notifySound).toBe("default");
    expect(settings.fajrSound).toBe("same");
  });

  it("Should read settings saved before sounds existed as the default sound", () => {
    const settings = migrateSettings({ notify: true, notifyMinutes: 10 });
    expect(settings.notifySound).toBe("default");
    expect(settings.fajrSound).toBe("same");
  });

  it("Should drop a sound this version does not ship", () => {
    const settings = migrateSettings({ notifySound: "adhan-9", fajrSound: 3 });
    expect(settings.notifySound).toBe("default");
    expect(settings.fajrSound).toBe("same");
  });

  it("Should keep a sound that was chosen", () => {
    const settings = migrateSettings({
      notifySound: "adhan-2",
      fajrSound: "silent",
    });
    expect(settings.notifySound).toBe("adhan-2");
    expect(settings.fajrSound).toBe("silent");
  });

  it("Should give Fajr its own sound only when one is set", () => {
    const same = { notifySound: "adhan-1", fajrSound: "same" } as const;
    const own = { notifySound: "adhan-1", fajrSound: "adhan-5" } as const;
    expect(soundForPrayer(Prayer.Fajr, same)).toBe("adhan-1");
    expect(soundForPrayer(Prayer.Fajr, own)).toBe("adhan-5");
    expect(soundForPrayer(Prayer.Isha, own)).toBe("adhan-1");
  });

  it("Should not play an adhan at sunrise", () => {
    expect(
      soundForPrayer(Prayer.Shuruq, { notifySound: "adhan-3", fajrSound: "same" })
    ).toBe("default");
    expect(
      soundForPrayer(Prayer.Shuruq, { notifySound: "silent", fajrSound: "same" })
    ).toBe("silent");
  });

  it("Should use the default sound for the prompt at the end of the list", () => {
    expect(
      soundForPrayer(null, { notifySound: "silent", fajrSound: "adhan-1" })
    ).toBe("default");
  });

  it("Should name a bundled file on iOS, and none for silence", () => {
    expect(iosSoundName("adhan-3")).toBe("adhan-3.caf");
    expect(iosSoundName("default")).toBe("default");
    expect(iosSoundName("silent")).toBeUndefined();
  });

  it("Should keep the channel the app has always used for the default sound", () => {
    expect(androidChannelId("default")).toBe("default");
    expect(androidChannelId("adhan-4")).toBe("adhan-4");
  });

  it("Should only preview the adhans", () => {
    expect(previewUrl("adhan-1")).toBe("sounds/adhan-1.mp3");
    expect(previewUrl("default")).toBeNull();
    expect(previewUrl("silent")).toBeNull();
  });

  it("Should recognise only the shipped sounds", () => {
    expect(isReminderSound("adhan-5")).toBe(true);
    expect(isReminderSound("same")).toBe(false);
    expect(isFajrSound("same")).toBe(true);
    expect(isFajrSound("adhan-6")).toBe(false);
  });
});

describe("bundled sound files", () => {
  // Every adhan the picker offers has to exist on all three platforms, or
  // choosing it plays nothing (or, on Android, posts to a channel whose
  // sound is missing).
  const root = join(__dirname, "../..");
  const adhans = REMINDER_SOUNDS.filter((sound) => sound.startsWith("adhan-"));

  for (const sound of adhans) {
    const n = sound.slice("adhan-".length);
    it(`Should ship ${sound} on the web, Android and iOS`, () => {
      expect(existsSync(join(root, "public/sounds", `${sound}.mp3`))).toBe(true);
      expect(
        existsSync(join(root, "android/app/src/main/res/raw", `adhan_${n}.ogg`))
      ).toBe(true);
      expect(existsSync(join(root, "ios/App/App/Sounds", `${sound}.caf`))).toBe(
        true
      );
    });
  }
});
