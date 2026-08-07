/**
 * Working with the timetable's own timezone rather than the device's.
 *
 * The prayer data is a UK timetable converted to UTC instants at build time.
 * Reading it back with the device's local date - which is what the app used to
 * do - means anyone whose phone is not on UK time gets the neighbouring day's
 * times, not merely a shifted version of the right ones.
 *
 * Uses Intl rather than a date library: every engine Capacitor runs on has the
 * full IANA database built in, so this needs no dependency and no data updates.
 */

export const UK_TIME_ZONE = "Europe/London";

export type ZonedDateParts = {
  year: number;
  month: number; // 1-12, as humans and Intl count them
  day: number;
};

export function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function readParts(instant: Date, timeZone: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") {
      out[part.type] = Number(part.value);
    }
  }
  return out;
}

/** The calendar date this instant falls on, as seen in `timeZone`. */
export function getZonedDateParts(
  instant: Date,
  timeZone: string
): ZonedDateParts {
  const parts = readParts(instant, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

/** Minutes `timeZone` is ahead of UTC at this instant. */
export function getZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const p = readParts(instant, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // The instant's own milliseconds are irrelevant and would skew the division.
  return (asIfUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000;
}

/**
 * Whether two zones currently show the same wall clock. Compared by offset
 * rather than by name on purpose: Europe/Dublin and Europe/London differ as
 * strings but never as clocks, and telling a user in Dublin that their times
 * need converting would be noise.
 */
export function zonesAgree(a: string, b: string, at: Date): boolean {
  return getZoneOffsetMinutes(at, a) === getZoneOffsetMinutes(at, b);
}

/**
 * An instant safely inside the calendar day `days` away from this one, as seen
 * in `timeZone`. Anchored at midday so no daylight saving shift can push it
 * over a boundary - adding 24h to an instant can land on the wrong day, or the
 * same one, when the clocks change.
 */
export function shiftZonedDay(
  instant: Date,
  timeZone: string,
  days: number
): Date {
  const { year, month, day } = getZonedDateParts(instant, timeZone);
  return new Date(Date.UTC(year, month - 1, day + days, 12));
}

/** An instant inside the given calendar day, for zones near UTC. */
export function middayOn(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12));
}

const timeFormatterCache = new Map<string, Intl.DateTimeFormat>();

/** The 24-hour clock time this instant shows in `timeZone`. */
export function formatTimeInZone(instant: Date, timeZone: string): string {
  let formatter = timeFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
    });
    timeFormatterCache.set(timeZone, formatter);
  }
  return formatter.format(instant);
}

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

/** The date this instant falls on in `timeZone`, as "Fri 7 Aug". */
export function formatDateInZone(instant: Date, timeZone: string): string {
  let formatter = dateFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    dateFormatterCache.set(timeZone, formatter);
  }
  return formatter.format(instant).replace(/,/g, "");
}

/** A short human name for a zone, e.g. "Gulf Standard Time". */
export function describeTimeZone(timeZone: string, at: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    timeZoneName: "long"
  }).formatToParts(at);
  return parts.find(p => p.type === "timeZoneName")?.value ?? timeZone;
}
