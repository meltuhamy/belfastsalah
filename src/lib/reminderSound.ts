import { Prayer } from "./PrayerTimes";

/**
 * The sound a prayer reminder makes.
 *
 * The adhans are short openings (the first takbir), each 30 seconds or less
 * because iOS will not play a longer notification sound. They are shown by
 * number only. The files are:
 *
 * - `public/sounds/adhan-N.mp3`, the preview played in settings
 * - `android/app/src/main/res/raw/adhan_N.ogg`, each with its own channel
 * - `ios/App/App/Sounds/adhan-N.caf`, in the app bundle
 */
export const REMINDER_SOUNDS = [
  "default",
  "silent",
  "adhan-1",
  "adhan-2",
  "adhan-3",
  "adhan-4",
  "adhan-5",
] as const;

export type ReminderSound = (typeof REMINDER_SOUNDS)[number];

/** Fajr either follows the other prayers or has a sound of its own. */
export type FajrSound = ReminderSound | "same";

export const reminderSoundLabels: Record<ReminderSound, string> = {
  default: "Default sound",
  silent: "Silent",
  "adhan-1": "Adhan 1",
  "adhan-2": "Adhan 2",
  "adhan-3": "Adhan 3",
  "adhan-4": "Adhan 4",
  "adhan-5": "Adhan 5",
};

export function isReminderSound(value: unknown): value is ReminderSound {
  return (REMINDER_SOUNDS as ReadonlyArray<unknown>).includes(value);
}

export function isFajrSound(value: unknown): value is FajrSound {
  return value === "same" || isReminderSound(value);
}

/**
 * The sound for one reminder. `null` is the "reminders stop here" prompt,
 * which is not a prayer and always uses the default sound. Sunrise never
 * plays an adhan.
 */
export function soundForPrayer(
  prayer: Prayer | null,
  settings: { notifySound: ReminderSound; fajrSound: FajrSound }
): ReminderSound {
  if (prayer === null) {
    return "default";
  }
  if (prayer === Prayer.Fajr && settings.fajrSound !== "same") {
    return settings.fajrSound;
  }
  // No adhan is called at sunrise, so its reminder keeps the plain sound.
  if (prayer === Prayer.Shuruq && settings.notifySound.startsWith("adhan-")) {
    return "default";
  }
  return settings.notifySound;
}

/**
 * The `sound` to give @capacitor/local-notifications on iOS, or undefined for
 * none.
 *
 * Leaving it out is silence on iOS, which is how every reminder used to be
 * scheduled - the reviews saying notifications made no sound. A name with no
 * file behind it gets the system's default sound instead, which is what the
 * plugin documents, so "default" asks for exactly that.
 */
export function iosSoundName(sound: ReminderSound): string | undefined {
  if (sound === "silent") {
    return undefined;
  }
  if (sound === "default") {
    return "default";
  }
  return `${sound}.caf`;
}

/**
 * The Android notification channel a sound plays on. A channel's sound is
 * fixed once created, so each sound has its own. "default" is the channel the
 * app has always posted to, which keeps whatever the user set on it. Must
 * match `ReminderSounds.kt`.
 */
export function androidChannelId(sound: ReminderSound): string {
  return sound;
}

/** The file played when the sound is chosen in settings, or null for none. */
export function previewUrl(sound: ReminderSound): string | null {
  return sound.startsWith("adhan-") ? `sounds/${sound}.mp3` : null;
}
