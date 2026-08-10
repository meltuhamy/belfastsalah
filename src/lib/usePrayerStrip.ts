import { useEffect, useState } from "react";
import { useSettings } from "./useSettings";
import { createPrayerTimes, PrayerDayTimes, PrayerTime } from "./PrayerTimes";
import { nextIsAfterDay } from "./prayerStrip";

/**
 * The six times to put in the strip.
 *
 * Today's, until the last prayer of the day has passed - after that the card
 * is counting down to tomorrow's Fajr, and a strip still showing today's times
 * would have nothing left to point at.
 *
 * Null while tomorrow's times are being fetched. Today's are already in state
 * by the time this runs, so the only wait is the one at the day's end, and the
 * following day is almost always in the same already-loaded timetable file.
 */
export function usePrayerStrip(
  today: PrayerDayTimes | null,
  next: PrayerTime | null
): PrayerDayTimes | null {
  const [settings] = useSettings();
  const [tomorrow, setTomorrow] = useState<PrayerDayTimes | null>(null);

  const location = settings?.location ?? null;
  const asrMethod = settings?.asrMethod ?? null;
  const rolled = nextIsAfterDay(today, next);

  // Identifies the day being asked for. Depending on the instant itself would
  // re-fetch on every one-second tick; this only changes when the day does.
  const wantedDay = rolled && next !== null ? next.time.getTime() : 0;

  useEffect(() => {
    if (!rolled || next === null || location === null || asrMethod === null) {
      setTomorrow(null);
      return;
    }

    let cancelled = false;
    createPrayerTimes(location, asrMethod)
      .getDay(next.time)
      .then((day) => {
        if (!cancelled) {
          setTomorrow(day);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolled, wantedDay, location, asrMethod]);

  return rolled ? tomorrow : today;
}
