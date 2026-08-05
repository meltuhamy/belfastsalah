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

  const tickDate = state.tick.getDate();

  useEffect(() => {
    if (times !== null) {
      times
        .getDay(state.tick)
        .then(dayTimes =>
          dispatch({ type: "setTodayTimes", payload: dayTimes })
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickDate, location, asrMethod]);

  const nextPrayer = state.currentTimes.next;
  const hasPassedNextPrayer =
    nextPrayer !== null && nextPrayer.time.getTime() <= state.tick.getTime();

  useEffect(() => {
    if (times !== null) {
      times
        .getNext(state.tick)
        .then(next => dispatch({ type: "setNextPrayer", payload: next }));

      times
        .getPrev(state.tick)
        .then(prev => dispatch({ type: "setPrevPrayer", payload: prev }));
    }
    // get new stuff every time the next prayer is passed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPassedNextPrayer, location, asrMethod]);

  return [state.currentTimes];
}
