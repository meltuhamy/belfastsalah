import { useEffect, useRef, useState } from "react";
import { useSettings } from "./useSettings";
import { createPrayerTimes, PrayerDayTimes, PrayerTime } from "./PrayerTimes";
import { timetableZoneFor } from "./PrayerTimeData";
import { shiftZonedDay } from "./timeZone";
import { PrayerStrip, StripPhase, stripOffset } from "./prayerStrip";

/**
 * The strip of times for the day card: prayerStrip.ts decides the phase, and
 * this fetches the days it needs.
 *
 * By day that is today, already in state. Overnight it is the evening's day
 * and the next, fetched by the Fajr the night is waiting for, which works the
 * same before midnight and after it.
 *
 * Both are almost always in the timetable file already loaded, but the fetch
 * is still a promise, so it starts as soon as the next prayer is a Fajr -
 * `nextFajr`, which it is all through Isha's adhan moment - and the days are
 * on hand by the time the night's slide is due. Should they not be, the strip
 * keeps what it was showing until they are, rather than going blank.
 *
 * `phase` is null while the times on hand are behind the clock, and so is
 * the strip, rather than showing a day that is not the phase's.
 */
export function usePrayerStrip(
  today: PrayerDayTimes | null,
  phase: StripPhase | null,
  nextFajr: PrayerTime | null
): PrayerStrip | null {
  const [settings] = useSettings();
  const [night, setNight] = useState<{
    key: string;
    days: [PrayerDayTimes, PrayerDayTimes];
  } | null>(null);

  const location = settings?.location ?? null;
  const asrMethod = settings?.asrMethod ?? null;
  // The Fajr whose night to fetch. Its instant rather than the object: the
  // object is new on every fetch of `next`, and this should only change when
  // the night does.
  const fajrTime =
    phase != null && phase.kind !== "day"
      ? phase.fajr.time.getTime()
      : nextFajr?.time.getTime() ?? 0;
  // Which night, of which timetable, so a night fetched for one place or Asr
  // is never taken for another's. After a change overnight the strip keeps
  // what it was showing until the new night arrives, as it does by day.
  const key = `${fajrTime}-${location}-${asrMethod}`;

  useEffect(() => {
    if (fajrTime === 0 || location === null || asrMethod === null) return;
    let cancelled = false;
    const prayerTimes = createPrayerTimes(location, asrMethod);
    const fajr = new Date(fajrTime);
    const evening = shiftZonedDay(fajr, timetableZoneFor(location), -1);
    Promise.all([prayerTimes.getDay(evening), prayerTimes.getDay(fajr)]).then(
      ([first, second]) => {
        if (!cancelled) setNight({ key, days: [first, second] });
      }
    );
    return () => {
      cancelled = true;
    };
    // `key` is made of the three.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fajrTime, location, asrMethod]);

  const shown = useRef<PrayerStrip | null>(null);
  if (phase == null) {
    shown.current = null;
  } else if (phase.kind === "day") {
    shown.current = today == null ? null : { days: [today], offset: 0 };
  } else if (night?.key === key) {
    shown.current = { days: night.days, offset: stripOffset(phase) };
  }
  return shown.current;
}
