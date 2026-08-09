/**
 * Which clock the app puts on screen, and when to say so.
 *
 * Times are stored as instants and rendered in whichever zone these functions
 * pick, so none of this moves a prayer: it only changes the numbers shown.
 * Reminders fire at the same moment whatever is chosen here.
 *
 * Kept as pure functions rather than hooks so the rules can be tested against
 * an arbitrary device zone. `deviceTimeZone` defaults to the real one, which
 * is what every caller in the app wants; tests pass it explicitly so they do
 * not depend on the TZ the suite happens to run under.
 */

import { AppSettings } from "./settings";
import { PrayerLocation, locationTimeZones } from "./PrayerTimeData";
import { getDeviceTimeZone, zonesAgree, UK_TIME_ZONE } from "./timeZone";

/**
 * Whether the device's clock disagrees with the timetable's, and so whether
 * there is any choice worth offering.
 *
 * Compared by offset rather than zone name: Europe/Dublin is not
 * Europe/London, but it never shows a different time, and offering someone in
 * Dublin a conversion they do not need would be noise.
 */
export function zoneChoiceApplies(
  location: PrayerLocation | null,
  at: Date,
  deviceTimeZone: string = getDeviceTimeZone()
): boolean {
  if (location === null) {
    return false;
  }
  return !zonesAgree(locationTimeZones[location], deviceTimeZone, at);
}

/**
 * The zone to render clock times in. Defaults to the timetable's own, so the
 * times on screen match the ones printed on the mosque timetable.
 */
export function resolveDisplayTimeZone(
  settings: AppSettings | null,
  deviceTimeZone: string = getDeviceTimeZone()
): string {
  if (settings == null || settings.location == null) {
    return UK_TIME_ZONE;
  }
  return settings.showTimesInDeviceZone
    ? deviceTimeZone
    : locationTimeZones[settings.location];
}

/**
 * Whether the times on screen are not the ones the device's own clock shows,
 * and so need labelling. False once someone has switched to their own clock,
 * because then there is nothing to explain.
 */
export function showsForeignZone(
  settings: AppSettings | null,
  at: Date,
  deviceTimeZone: string = getDeviceTimeZone()
): boolean {
  if (settings == null || settings.showTimesInDeviceZone) {
    return false;
  }
  return zoneChoiceApplies(settings.location, at, deviceTimeZone);
}

/**
 * Whether to show the one-off prompt. Asked once and never again: either
 * answer sets `timeZoneNoticeSeen`, as does changing the setting directly.
 */
export function shouldPromptForZone(
  settings: AppSettings | null,
  at: Date,
  deviceTimeZone: string = getDeviceTimeZone()
): boolean {
  if (settings == null || settings.timeZoneNoticeSeen) {
    return false;
  }
  return zoneChoiceApplies(settings.location, at, deviceTimeZone);
}
