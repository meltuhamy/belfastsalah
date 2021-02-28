import { AppContext } from "../State";
import { useContext, useEffect } from "react";
import { useSettings } from "./useSettings";
import {
  PrayerLocation,
  LondonPrayerTimes,
  BelfastPrayerTimes,
  AsrMethod,
  PrayerTimes
} from "./PrayerTimes";

export function usePrayerDay() {
  const { state, dispatch } = useContext(AppContext);
  const [settings] = useSettings();

  let location: PrayerLocation | null = null;
  let asrMethod: AsrMethod | null = null;

  if (settings) {
    location = settings.location;
    asrMethod = settings.asrMethod;
  }

  let times: PrayerTimes | null = null;
  if (location !== null && asrMethod !== null) {
    times =
      location === PrayerLocation.London
        ? new LondonPrayerTimes(asrMethod)
        : new BelfastPrayerTimes();
  }

  useEffect(() => {
    times !== null &&
      times
        .getDay(state.tick)
        .then(dayTimes =>
          dispatch({ type: "setTodayTimes", payload: dayTimes })
        );
  }, [state.tick.getDate(), location, asrMethod]);

  const nextPrayer = state.currentTimes.next;
  const hasPassedNextPrayer =
    nextPrayer !== null && nextPrayer.time.getTime() <= state.tick.getTime();

  useEffect(() => {
    times !== null &&
      times
        .getNext(state.tick)
        .then(nextPrayer =>
          dispatch({ type: "setNextPrayer", payload: nextPrayer })
        );

    times !== null &&
      times
        .getPrev(state.tick)
        .then(prevPrayer =>
          dispatch({ type: "setPrevPrayer", payload: prevPrayer })
        );
  }, [hasPassedNextPrayer, location, asrMethod]); // get new stuff every time the next prayer is passed

  return [state.currentTimes];
}
