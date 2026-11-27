import { getMonthNames } from "./dateUtils";
import { formatDateInZone, ZonedDateParts } from "./timeZone";

/**
 * The days the home screen's Next 7 days card shows, from today (MEL-363).
 *
 * Today is always the first row, so it is on screen without scrolling on the
 * 31st as on the 1st. Where the run of days crosses into a new month a
 * divider names it, with the year too when the year turns over as well.
 *
 * Pure calendar arithmetic on the timetable's own calendar date - the caller
 * reads that in the timetable's zone - so the device's clock plays no part.
 */

export type NextDay = {
  kind: "day";
  /** "2026-11-27": stable across the once-a-second re-render. */
  key: string;
  year: number;
  /** 0 for January, as Date and getMonth have it. */
  month: number;
  day: number;
  /** "Fri" */
  weekday: string;
  /** "Fri 27 Nov" */
  label: string;
  isToday: boolean;
};

export type NextDaysDivider = {
  kind: "divider";
  key: string;
  /** "December", or "January 2027" when the year changes too. */
  label: string;
};

export type NextDaysEntry = NextDay | NextDaysDivider;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// From the formatter the day card writes its date with, so both cards say
// "Sept" for September, as en-GB does.
const SHORT_MONTHS = getMonthNames().map(
  (_, m) =>
    formatDateInZone(new Date(Date.UTC(2026, m, 1, 12)), "UTC").split(" ")[2]
);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The `count` days from `today`, with a divider before each new month. */
export function nextDays(
  today: ZonedDateParts,
  count = 7
): Array<NextDaysEntry> {
  const entries: Array<NextDaysEntry> = [];
  for (let i = 0; i < count; i++) {
    // Midday UTC on the calendar day, so the arithmetic never meets a clock
    // change; Date.UTC rolls the day over into the next month and year.
    const date = new Date(
      Date.UTC(today.year, today.month - 1, today.day + i, 12)
    );
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    if (i > 0 && day === 1) {
      const name = getMonthNames()[month];
      entries.push({
        kind: "divider",
        key: `divider-${year}-${pad(month + 1)}`,
        label: year === today.year ? name : `${name} ${year}`,
      });
    }
    const weekday = WEEKDAYS[date.getUTCDay()];
    entries.push({
      kind: "day",
      key: `${year}-${pad(month + 1)}-${pad(day)}`,
      year,
      month,
      day,
      weekday,
      label: `${weekday} ${day} ${SHORT_MONTHS[month]}`,
      isToday: i === 0,
    });
  }
  return entries;
}
