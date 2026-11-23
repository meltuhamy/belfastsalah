/**
 * The few minutes after a prayer comes in, while its adhan is being called.
 *
 * For that window the day card says "It's time for Asr" rather than counting
 * down to Maghrib, keeps Asr highlighted, and shows the adhan icon calling.
 * Pure, so the edges - the first second, the last, Shuruq, a `next` that has
 * not caught up yet - can be tested against any clock.
 */

import { Prayer, PrayerTime } from "./PrayerTimes";

/** How long a prayer counts as "now" after it comes in. */
export const ADHAN_WINDOW_MS = 10 * 60 * 1000;

/** How long of that the icon shows the call going out; it is still after. */
export const CALLING_MS = 5 * 60 * 1000;

/**
 * The prayer whose time has come within the window, or null.
 *
 * Usually that is `prev`. But for a moment after a prayer's time `next` is
 * still that prayer, until the app has worked out the one after it - which is
 * when the card used to go blank - so a `next` that has already arrived counts
 * too, and so does any of the day's own times: at a prayer's exact second the
 * lookups behind `prev` and `next` count it as neither. Shuruq is sunrise, not
 * a prayer: no adhan is called for it.
 */
export function prayerNow(
  prev: PrayerTime | null,
  next: PrayerTime | null,
  now: Date,
  day: ReadonlyArray<PrayerTime> | null = null
): PrayerTime | null {
  for (const candidate of [next, prev, ...(day ?? [])]) {
    if (candidate == null || candidate.prayer === Prayer.Shuruq) continue;
    const since = now.getTime() - candidate.time.getTime();
    if (since >= 0 && since < ADHAN_WINDOW_MS) return candidate;
  }
  return null;
}

/** Whether the adhan icon should be showing the call going out. */
export function isCalling(current: PrayerTime | null, now: Date): boolean {
  return current != null && now.getTime() - current.time.getTime() < CALLING_MS;
}

/**
 * The prayer still to come: `next`, unless it has already arrived and the app
 * has not caught up, in which case the first of the day's times still ahead.
 * Null if there is none on hand yet, which lasts a moment at most.
 */
export function upcomingPrayer(
  next: PrayerTime | null,
  day: ReadonlyArray<PrayerTime> | null,
  now: Date
): PrayerTime | null {
  if (next != null && next.time.getTime() > now.getTime()) return next;
  return day?.find((p) => p.time.getTime() > now.getTime()) ?? null;
}
