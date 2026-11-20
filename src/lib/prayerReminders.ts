import { Prayer } from "./PrayerTimes";
import {
  FajrSound,
  isFajrSound,
  isReminderSound,
  ReminderSound,
} from "./reminderSound";

/**
 * How each prayer reminds: whether it does at all, when, and with what sound.
 *
 * One entry per prayer in the strip, sunrise included. `offset` is minutes
 * from the prayer's own time, negative before it and positive after, within
 * OFFSET_LIMIT either way.
 */
export type PrayerReminder = {
  on: boolean;
  offset: number;
  sound: ReminderSound;
};

export const REMINDER_PRAYERS = [
  Prayer.Fajr,
  Prayer.Shuruq,
  Prayer.Duhr,
  Prayer.Asr,
  Prayer.Maghrib,
  Prayer.Isha,
] as const;

export type PrayerKey = "fajr" | "shuruq" | "duhr" | "asr" | "maghrib" | "isha";

export const PRAYER_KEYS: ReadonlyArray<PrayerKey> = [
  "fajr",
  "shuruq",
  "duhr",
  "asr",
  "maghrib",
  "isha",
];

export type PrayerReminders = Record<PrayerKey, PrayerReminder>;

/** Half an hour either side of the prayer. */
export const OFFSET_LIMIT = 30;

/** What every prayer starts on, and what reminders were before this setting. */
export const DEFAULT_MINUTES_BEFORE = 5;

export function prayerKey(prayer: Prayer): PrayerKey {
  return PRAYER_KEYS[prayer];
}

export function prayerOfKey(key: PrayerKey): Prayer {
  return REMINDER_PRAYERS[PRAYER_KEYS.indexOf(key)];
}

export function isPrayerKey(value: unknown): value is PrayerKey {
  return (PRAYER_KEYS as ReadonlyArray<unknown>).includes(value);
}

export function defaultReminders(
  minutesBefore: number = DEFAULT_MINUTES_BEFORE,
  sound: ReminderSound = "default",
  fajrSound: FajrSound = "same"
): PrayerReminders {
  // 0 - x rather than -x, so no lead time is 0 and not -0.
  const offset = 0 - clampOffset(minutesBefore);
  const entry = (s: ReminderSound): PrayerReminder => ({ on: true, offset, sound: s });
  return {
    fajr: entry(fajrSound === "same" ? sound : fajrSound),
    shuruq: entry(sound),
    duhr: entry(sound),
    asr: entry(sound),
    maghrib: entry(sound),
    isha: entry(sound),
  };
}

export function clampOffset(minutes: number): number {
  if (!Number.isFinite(minutes)) {
    return -DEFAULT_MINUTES_BEFORE;
  }
  return Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, Math.round(minutes)));
}

type LegacyReminderFields = {
  // One lead time for every prayer, before this setting existed.
  notifyMinutes?: unknown;
  // One sound, plus Fajr's own, from the first version of reminder sounds.
  notifySound?: unknown;
  fajrSound?: unknown;
};

/**
 * The stored reminders brought up to the current shape.
 *
 * Settings from before per-prayer reminders keep what they did: their one
 * lead time on every prayer, and any sound they had chosen. Anything in a
 * stored entry that this version cannot use falls back to that prayer's
 * default rather than taking the whole setting with it.
 */
export function migrateReminders(
  stored: unknown,
  legacy: LegacyReminderFields = {}
): PrayerReminders {
  const minutes =
    typeof legacy.notifyMinutes === "number"
      ? legacy.notifyMinutes
      : DEFAULT_MINUTES_BEFORE;
  const sound = isReminderSound(legacy.notifySound) ? legacy.notifySound : "default";
  const fajr = isFajrSound(legacy.fajrSound) ? legacy.fajrSound : "same";
  const base = defaultReminders(minutes, sound, fajr);

  if (stored === null || typeof stored !== "object") {
    return base;
  }
  const result = { ...base };
  for (const key of PRAYER_KEYS) {
    const entry = (stored as Record<string, unknown>)[key];
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const { on, offset, sound: s } = entry as Record<string, unknown>;
    result[key] = {
      on: typeof on === "boolean" ? on : base[key].on,
      offset: typeof offset === "number" ? clampOffset(offset) : base[key].offset,
      sound: isReminderSound(s) ? s : base[key].sound,
    };
  }
  return result;
}

/** Which of a reminder's fields are not the same for every prayer. */
export type MixedFields = Record<keyof PrayerReminder, boolean>;

/**
 * What "All prayers" shows: each field as every prayer has it, and where
 * they differ, which fields those are. A mixed field shows nothing chosen,
 * so whatever is touched is written to all six, even Fajr's own value. On
 * reads as on while any prayer is, so the rest of the editor is there.
 */
export function remindersForAll(reminders: PrayerReminders): {
  value: PrayerReminder;
  mixed: MixedFields;
} {
  const all = PRAYER_KEYS.map((key) => reminders[key]);
  const differs = (field: keyof PrayerReminder) =>
    all.some((r) => r[field] !== all[0][field]);
  return {
    value: { ...all[0], on: all.some((r) => r.on) },
    mixed: { on: differs("on"), offset: differs("offset"), sound: differs("sound") },
  };
}

/** Every prayer set to the same thing, or null when they differ. */
export function commonReminder(reminders: PrayerReminders): PrayerReminder | null {
  const first = reminders[PRAYER_KEYS[0]];
  const same = PRAYER_KEYS.every((key) => {
    const r = reminders[key];
    return r.on === first.on && r.offset === first.offset && r.sound === first.sound;
  });
  return same ? first : null;
}

export function anyReminderOn(reminders: PrayerReminders): boolean {
  return PRAYER_KEYS.some((key) => reminders[key].on);
}

function minutesWord(n: number): string {
  return n === 1 ? "minute" : "minutes";
}

/** "10 min before", "At prayer time", "10 min after": a row's second line. */
export function describeOffsetShort(offset: number): string {
  if (offset === 0) {
    return "At prayer time";
  }
  return `${Math.abs(offset)} min ${offset < 0 ? "before" : "after"}`;
}

/** "10 minutes before Fajr", "At Fajr time", "1 minute after Isha". */
export function describeOffset(offset: number, prayerName: string): string {
  if (offset === 0) {
    return `At ${prayerName} time`;
  }
  const n = Math.abs(offset);
  return `${n} ${minutesWord(n)} ${offset < 0 ? "before" : "after"} ${prayerName}`;
}

/** "−10", "0", "+10": the label over a reminder on the test timeline. */
export function offsetLabel(offset: number): string {
  if (offset === 0) {
    return "0";
  }
  return `${offset < 0 ? "−" : "+"}${Math.abs(offset)}`;
}

/**
 * A notification's second line. The title already names the prayer and its
 * time, so this only says how far off it is.
 */
export function reminderBody(offset: number): string {
  if (offset === 0) {
    return "Prayer time now";
  }
  const n = Math.abs(offset);
  return offset < 0 ? `In ${n} ${minutesWord(n)}` : `${n} ${minutesWord(n)} ago`;
}

/**
 * The sound for one reminder. `null` is the "reminders stop here" prompt,
 * which is not a prayer and always uses the default sound.
 */
export function soundForPrayer(
  prayer: Prayer | null,
  reminders: PrayerReminders
): ReminderSound {
  return prayer === null ? "default" : reminders[prayerKey(prayer)].sound;
}
