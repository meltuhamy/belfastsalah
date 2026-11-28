import { useEffect, useState } from "react";
import { useSettings } from "./useSettings";
import { createPrayerTimes, Prayer, PrayerDayTimes } from "./PrayerTimes";
import { timetableZoneFor } from "./PrayerTimeData";
import { shiftZonedDay } from "./timeZone";
import { SkyTimes, skyTimesFor } from "./realSky";

/**
 * The times Sky V2 is fitted to (realSky.ts): today's, and the Isha before
 * and the Fajr after from the neighbouring days, fetched whenever today
 * changes. Null until they are on hand.
 */
export function useSkyTimes(today: PrayerDayTimes | null): SkyTimes | null {
  const [settings] = useSettings();
  const location = settings?.location ?? null;
  const asrMethod = settings?.asrMethod ?? null;
  const [times, setTimes] = useState<{ key: string; times: SkyTimes } | null>(null);
  const dayKey = today?.[Prayer.Duhr].time.getTime() ?? 0;
  const key = `${dayKey}-${location}-${asrMethod}`;

  useEffect(() => {
    if (today == null || location === null || asrMethod === null) return;
    let cancelled = false;
    const prayerTimes = createPrayerTimes(location, asrMethod);
    const zone = timetableZoneFor(location);
    const midday = today[Prayer.Duhr].time;
    Promise.all([
      prayerTimes.getDay(shiftZonedDay(midday, zone, -1)),
      prayerTimes.getDay(shiftZonedDay(midday, zone, 1)),
    ]).then(([yesterday, tomorrow]) => {
      if (!cancelled) setTimes({ key, times: skyTimesFor(yesterday, today, tomorrow) });
    });
    return () => {
      cancelled = true;
    };
    // `key` is made of these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return times?.key === key ? times.times : null;
}
