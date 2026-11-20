import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  androidChannelId,
  iosSoundName,
  isFajrSound,
  isReminderSound,
  previewUrl,
  REMINDER_SOUNDS,
  reminderSoundLabels,
  SOUND_SECONDS,
} from "./reminderSound";

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

  it("Should know how long each sound plays, within iOS's 30 second limit", () => {
    for (const sound of REMINDER_SOUNDS) {
      expect(SOUND_SECONDS[sound]).toBeGreaterThan(0);
      expect(SOUND_SECONDS[sound]).toBeLessThanOrEqual(30);
    }
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
