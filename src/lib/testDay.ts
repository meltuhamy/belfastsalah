/**
 * The arithmetic behind the test day's timeline.
 *
 * The bar is not to scale. Each of the six prayers gets an equal slot, and
 * inside a slot the half hour either side of the prayer takes most of the
 * room, so a reminder ten minutes early sits visibly left of its prayer
 * instead of on top of it. Times map to positions (0 to 1) through a list of
 * anchors and straight lines between them.
 */

import { OFFSET_LIMIT } from "./prayerReminders";

const MINUTE = 60_000;

/** How far beyond the first and last prayer the day runs. */
export const DAY_MARGIN_MS = 60 * MINUTE;

/** Seconds the playhead takes from one end of the bar to the other. */
export const BAR_SECONDS = 30;

type Anchor = [time: number, position: number];

export function anchors(prayerTimes: ReadonlyArray<number>): Anchor[] {
  const n = prayerTimes.length;
  const half = (0.5 / n) * 0.8;
  const window = OFFSET_LIMIT * MINUTE;
  const points: Anchor[] = [[prayerTimes[0] - DAY_MARGIN_MS, 0]];
  prayerTimes.forEach((t, i) => {
    const centre = (i + 0.5) / n;
    points.push([t - window, centre - half], [t, centre], [t + window, centre + half]);
  });
  points.push([prayerTimes[n - 1] + DAY_MARGIN_MS, 1]);
  return points;
}

export function dayStart(prayerTimes: ReadonlyArray<number>): number {
  return prayerTimes[0] - DAY_MARGIN_MS;
}

export function dayEnd(prayerTimes: ReadonlyArray<number>): number {
  return prayerTimes[prayerTimes.length - 1] + DAY_MARGIN_MS;
}

export function toPosition(points: ReadonlyArray<Anchor>, time: number): number {
  if (time <= points[0][0]) return 0;
  for (let i = 1; i < points.length; i++) {
    const [t1, p1] = points[i];
    if (time <= t1) {
      const [t0, p0] = points[i - 1];
      return p0 + ((time - t0) / (t1 - t0)) * (p1 - p0);
    }
  }
  return 1;
}

export function toTime(points: ReadonlyArray<Anchor>, position: number): number {
  if (position <= 0) return points[0][0];
  for (let i = 1; i < points.length; i++) {
    const [t1, p1] = points[i];
    if (position <= p1) {
      const [t0, p0] = points[i - 1];
      return t0 + ((position - p0) / (p1 - p0)) * (t1 - t0);
    }
  }
  return points[points.length - 1][0];
}

/**
 * Where the playhead is after `elapsedMs` more of playing: a steady speed
 * along the bar, so the minutes either side of a prayer pass as slowly as the
 * hours of the night pass quickly.
 */
export function advance(
  points: ReadonlyArray<Anchor>,
  time: number,
  elapsedMs: number
): number {
  const position = toPosition(points, time) + elapsedMs / (BAR_SECONDS * 1000);
  return Math.max(time + 1, toTime(points, Math.min(1, position)));
}

/** The prayer whose mark is nearest a position on the bar. */
export function nearestPrayer(
  points: ReadonlyArray<Anchor>,
  prayerTimes: ReadonlyArray<number>,
  position: number
): number {
  let best = 0;
  prayerTimes.forEach((t, i) => {
    const distance = Math.abs(toPosition(points, t) - position);
    if (distance < Math.abs(toPosition(points, prayerTimes[best]) - position)) {
      best = i;
    }
  });
  return best;
}

/**
 * Where dragging the timeline to a prayer stops: a minute before the
 * earliest its reminder can be, so pressing play from there plays that
 * prayer's reminder, whenever it is set.
 */
export function stopBefore(prayerTime: number): number {
  return prayerTime - (OFFSET_LIMIT + 1) * MINUTE;
}
