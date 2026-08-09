import { useSettings } from "./useSettings";
import { resolveDisplayTimeZone } from "./displayZone";

/**
 * The zone the app should render clock times in.
 *
 * Defaults to the timetable's own zone, so the times on screen match the ones
 * printed on the mosque timetable. Someone away from the UK can switch to
 * their own clock in settings; the instants are identical either way, so
 * reminders are unaffected by the choice.
 */
export function useDisplayTimeZone(): string {
  const [settings] = useSettings();
  return resolveDisplayTimeZone(settings);
}
