import { useEffect, useRef, useState } from "react";
import { useSettings } from "./useSettings";
import { createPrayerTimes, PrayerDayTimes } from "./PrayerTimes";
import { timetableZoneFor } from "./PrayerTimeData";
import { shiftZonedDay } from "./timeZone";
import { PrayerStrip, StripPhase, stripOffset } from "./prayerStrip";

/**
 * The strip of times for the day card: prayerStrip.ts decides the phase, and
 * this fetches the days it needs.
 *
 * By day that is today, already in state. Overnight it is the evening's day
 * and the next, fetched by the Fajr the night is waiting for, which works the
 * same before midnight and after it. Both are almost always in the timetable
 * file already loaded, but the fetch is still a promise: until it settles the
 * strip keeps what it was showing, so the slide at the end of Isha's moment
 * starts from the day's own layout rather than from a blank.
 */
export function usePrayerStrip(
  today: PrayerDayTimes | null,
  phase: StripPhase
): PrayerStrip | null {
  const [settings] = useSettings();
  const [night, setNight] = useState<{
    key: number;
    days: [PrayerDayTimes, PrayerDayTimes];
  } | null>(null);

  const location = settings?.location ?? null;
  const asrMethod = settings?.asrMethod ?? null;
  // Identifies the night being asked for. Depending on the instant itself would
  // re-fetch on every one-second tick; this only changes when the night does.
  const wanted = phase.kind === "day" ? 0 : phase.fajr.time.getTime();

  useEffect(() => {
    if (wanted === 0 || location === null || asrMethod === null) return;
    let cancelled = false;
    const prayerTimes = createPrayerTimes(location, asrMethod);
    const fajr = new Date(wanted);
    const evening = shiftZonedDay(fajr, timetableZoneFor(location), -1);
    Promise.all([prayerTimes.getDay(evening), prayerTimes.getDay(fajr)]).then(
      ([first, second]) => {
        if (!cancelled) setNight({ key: wanted, days: [first, second] });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [wanted, location, asrMethod]);

  const shown = useRef<PrayerStrip | null>(null);
  if (phase.kind === "day") {
    shown.current = today == null ? null : { days: [today], offset: 0 };
  } else if (night?.key === wanted) {
    shown.current = { days: night.days, offset: stripOffset(phase) };
  }
  return shown.current;
}
