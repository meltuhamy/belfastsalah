import { useEffect, useState } from "react";
import { AppSettings } from "./settings";
import {
  getDeviceUses24Hour,
  startDeviceTimeFormatWatch,
  subscribeDeviceUses24Hour,
} from "./deviceTimeFormat";
import { uses24Hour } from "./timeFormat";

/**
 * The phone's own 12/24-hour switch, kept current.
 *
 * Subscribing rather than reading once is the point: someone can leave the
 * app, turn the switch, and come back, and the times must follow without a
 * relaunch. The native plugin sends the change; this is where React hears it.
 */
export function useDeviceUses24Hour(): boolean {
  const [deviceUses24Hour, setDeviceUses24Hour] = useState(
    getDeviceUses24Hour
  );

  useEffect(() => {
    void startDeviceTimeFormatWatch();
    // Re-read on subscribe: the answer can arrive between first render and
    // this effect, and that change would otherwise never reach this component.
    setDeviceUses24Hour(getDeviceUses24Hour());
    return subscribeDeviceUses24Hour(setDeviceUses24Hour);
  }, []);

  return deviceUses24Hour;
}

/** Whether clock times are on a 24-hour clock, given the saved setting. */
export function useUses24Hour(settings: AppSettings | null): boolean {
  const deviceUses24Hour = useDeviceUses24Hour();
  return uses24Hour(settings?.timeFormat ?? "system", deviceUses24Hour);
}
