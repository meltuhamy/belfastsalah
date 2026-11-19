/**
 * How clock times are written, and what decides it.
 *
 * One setting with three values rather than a stored boolean sampled from the
 * device once: "System" is the default and follows the phone's own 12/24-hour
 * switch, which the web layer cannot see (it only sees language and region),
 * so the native shells read it. 12-hour and 24-hour override the phone.
 *
 * Only clock times go through here. The countdown is a length of time, not a
 * time of day, and is unchanged by this setting.
 */

export type TimeFormat = "system" | "12" | "24";

// Also the order they appear in the picker.
export const TIME_FORMATS: ReadonlyArray<TimeFormat> = [
  "system",
  "12",
  "24",
];

export const timeFormatLabels: Record<TimeFormat, string> = {
  system: "System",
  "12": "12-hour",
  "24": "24-hour",
};

/** Whether the chosen format puts times on a 24-hour clock right now. */
export function uses24Hour(
  format: TimeFormat,
  deviceUses24Hour: boolean
): boolean {
  switch (format) {
    case "12":
      return false;
    case "24":
      return true;
    case "system":
      return deviceUses24Hour;
  }
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function clockFormatter(
  timeZone: string,
  twentyFourHour: boolean
): Intl.DateTimeFormat {
  const key = `${timeZone}|${twentyFourHour ? "24" : "12"}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    // en-US for the 12-hour clock so it reads "5:16 AM"; en-GB for the
    // 24-hour one, which is the form the timetable prints.
    formatter = new Intl.DateTimeFormat(twentyFourHour ? "en-GB" : "en-US", {
      timeZone,
      hourCycle: twentyFourHour ? "h23" : "h12",
      hour: twentyFourHour ? "2-digit" : "numeric",
      minute: "2-digit",
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/**
 * A clock time in `timeZone`, in the chosen format: "05:16" or "5:16 AM".
 *
 * Cached like the formatters in timeZone.ts: the app re-renders every second
 * off the countdown ticker, and building an ICU formatter each time is work
 * with no result.
 */
export function formatClockTime(
  instant: Date,
  timeZone: string,
  twentyFourHour: boolean
): string {
  return clockFormatter(timeZone, twentyFourHour).format(instant);
}
