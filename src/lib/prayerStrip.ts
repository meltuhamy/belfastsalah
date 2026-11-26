/**
 * What the strip of times along the bottom of the day card shows, and where.
 *
 * The strip is a window six columns wide onto a row of one or two days. By day
 * it shows that day. Once Isha's adhan moment is over it holds two days, the
 * evening's and the next, slid one column left, so the evening's prayers move
 * over and the next Fajr comes in on the right. When that Fajr comes in the
 * row slides five more, bringing the new day's start back to the left edge,
 * and once Fajr's moment is over the row is that day alone again, where the
 * same six times sit in the same places.
 *
 * Pure so the rules can be tested against an arbitrary clock: the interesting
 * cases are all at the ends of the night, which are not convenient to reach
 * by waiting.
 */

import { Prayer, PrayerDayTimes, PrayerTime } from "./PrayerTimes";

/**
 * Which part of the night or day it is, for the strip.
 *
 * - `day`: one day, from Fajr's moment ending until Isha's does.
 * - `night`: the evening and the next day, slid one column, until Fajr.
 * - `fajr`: the same two days, slid six, for Fajr's adhan moment.
 *
 * `fajr` names the Fajr the night is waiting for, which is what decides the
 * two days to show.
 */
export type StripPhase =
  | { kind: "day" }
  | { kind: "night" | "fajr"; fajr: PrayerTime };

/**
 * `current` is the prayer whose adhan is being called (adhanMoment.ts), and
 * `upcoming` the one still to come.
 */
export function stripPhase(
  current: PrayerTime | null,
  upcoming: PrayerTime | null
): StripPhase {
  if (current?.prayer === Prayer.Fajr) {
    return { kind: "fajr", fajr: current };
  }
  if (current == null && upcoming?.prayer === Prayer.Fajr) {
    return { kind: "night", fajr: upcoming };
  }
  return { kind: "day" };
}

/** How many columns the row has slid left, in each phase. */
export function stripOffset(phase: StripPhase): number {
  switch (phase.kind) {
    case "day":
      return 0;
    case "night":
      return 1;
    case "fajr":
      return 6;
  }
}

/** The six columns' worth of times on show, and the row they come from. */
export type PrayerStrip = {
  /** One day, or the evening's and the next. */
  days: ReadonlyArray<PrayerDayTimes>;
  /** Columns slid left: the first time on show is `cells[offset]`. */
  offset: number;
};

/** The strip's times in a row, first day first. */
export function stripCells(strip: PrayerStrip): ReadonlyArray<PrayerTime> {
  return strip.days.flatMap((day) => day);
}

/**
 * Where the highlighted prayer is in the row: the one at `target`'s instant,
 * since with two days on hand there are two of every prayer. -1 if none.
 */
export function stripIndexOf(
  cells: ReadonlyArray<PrayerTime>,
  target: PrayerTime | null
): number {
  if (target == null) return -1;
  return cells.findIndex((p) => p.time.getTime() === target.time.getTime());
}

/**
 * How far along the row now is, in columns: 0 at the first Fajr's dot, 1 at
 * Shuruq's, and in between by time, through to the last time on hand. Null
 * before the first time. `lastPassed` is the last time that has come in.
 */
export function stripProgress(
  cells: ReadonlyArray<PrayerTime>,
  now: Date
): { progress: number | null; lastPassed: number } {
  let lastPassed = -1;
  cells.forEach((p, i) => {
    if (p.time.getTime() <= now.getTime()) lastPassed = i;
  });
  if (lastPassed < 0) return { progress: null, lastPassed };
  const from = cells[lastPassed].time.getTime();
  const to = cells[lastPassed + 1]?.time.getTime();
  const progress =
    to === undefined
      ? lastPassed
      : lastPassed + Math.min(1, (now.getTime() - from) / (to - from));
  return { progress, lastPassed };
}

/**
 * One line along the timeline, in the row's columns: each day's runs from its
 * own Fajr as far as now, into the next day's Fajr at most. `solid` is how
 * much of it lies between times that have both come in; the rest, since the
 * last one, fades out towards now. `gone` once the row has slid the whole day
 * off the card: its line slides away with it, fading as it goes.
 */
export type TimelineLine = {
  from: number;
  length: number;
  solid: number;
  gone: boolean;
};

export function timelineLines(
  dayCount: number,
  progress: number | null,
  lastPassed: number,
  offset: number
): Array<TimelineLine | null> {
  return Array.from({ length: dayCount }, (_, d) => {
    const from = d * 6;
    if (progress == null || progress < from) return null;
    const end = Math.min(progress, d + 1 < dayCount ? from + 6 : from + 5);
    const length = end - from;
    const solidTo = Math.min(lastPassed, end);
    return {
      from,
      length,
      solid: length > 0 ? Math.max(0, (solidTo - from) / length) : 1,
      gone: from + 6 <= offset,
    };
  });
}
