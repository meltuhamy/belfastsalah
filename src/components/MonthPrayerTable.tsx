import React, { useState, useEffect, useContext, useRef } from "react";
import {
  PrayerTime,
  PrayerLocation,
  createPrayerTimes,
  PrayerDayTimes,
  AsrMethod,
} from "../lib/PrayerTimes";
import { AppContext } from "../State";
import { getZonedDateParts } from "../lib/timeZone";
import { formatClockTime } from "../lib/timeFormat";
import { useDisplayTimeZone } from "../lib/useDisplayTimeZone";
import { useUses24Hour } from "../lib/useTimeFormat";
import { timetableZoneFor } from "../lib/PrayerTimeData";
import { IonSkeletonText } from "@ionic/react";
import { useMeasured } from "../lib/useMeasured";
import "./MonthPrayerTable.css";

const MonthPrayerTableCol: React.FC<{
  prayer: PrayerTime;
  timeZone: string;
  uses24: boolean;
}> = ({ prayer, timeZone, uses24 }) => {
  return (
    <td className="MonthPrayerTable__col">
      {formatClockTime(prayer.time, timeZone, uses24)}
    </td>
  );
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** "27" over a small "Fr": the day, and which day of the week it is. */
const DayLabel: React.FC<{ year: number; month: number; day: number }> = ({
  year,
  month,
  day,
}) => (
  <span className="MonthPrayerTable__day">
    <span className="MonthPrayerTable__date">{day}</span>
    <span className="MonthPrayerTable__weekday" aria-hidden="true">
      {WEEKDAYS[new Date(Date.UTC(year, month, day, 12)).getUTCDay()]}
    </span>
  </span>
);

type Props = { month: number; year: number };

const MonthPrayerTable: React.FC<Props> = ({ month, year }) => {
  const { state } = useContext(AppContext);
  const displayTimeZone = useDisplayTimeZone();
  const uses24 = useUses24Hour(state.settings.value);
  const now = state.tick;
  // Which row is "today" is a question about the timetable's calendar, not the
  // device's, so it stays in the timetable zone whatever times are shown in.
  const today = getZonedDateParts(
    now,
    timetableZoneFor(state.settings.value?.location ?? null)
  );
  const isToday = (i: number) =>
    year === today.year && month === today.month - 1 && i + 1 === today.day;
  const getClassNameForRow = (i: number) => {
    return isToday(i)
      ? "MonthPrayerTable__row MonthPrayerTable__row--selected"
      : "MonthPrayerTable__row";
  };

  const [monthData, setMonthData] = useState<Array<PrayerDayTimes> | null>(
    null
  );

  const settings = state.settings.value;
  let location: PrayerLocation | null = null;
  let asrMethod: AsrMethod | null = null;

  if (settings) {
    location = settings.location;
    asrMethod = settings.asrMethod;
  }

  useEffect(() => {
    if (location !== null && asrMethod !== null) {
      const times = createPrayerTimes(location, asrMethod);

      times.getMonth(month, year).then((data) => {
        setMonthData(data);
      });
    }
  }, [month, year, location, asrMethod]);

  const monthLoading = Array.from({ length: 30 }).map((_, index) => (
    <tr className="MonthPrayerTable__row" key={index}>
      <td className="MonthPrayerTable__col MonthPrayerTable__col--day">
        <DayLabel year={year} month={month} day={index + 1} />
      </td>
      <td className="MonthPrayerTable__col">
        <IonSkeletonText />
      </td>
      <td className="MonthPrayerTable__col">
        <IonSkeletonText />
      </td>
      <td className="MonthPrayerTable__col">
        <IonSkeletonText />
      </td>
      <td className="MonthPrayerTable__col">
        <IonSkeletonText />
      </td>
      <td className="MonthPrayerTable__col">
        <IonSkeletonText />
      </td>
      <td className="MonthPrayerTable__col">
        <IonSkeletonText />
      </td>
    </tr>
  ));
  // At a large system text size seven columns of times do not fit across the
  // phone (MEL-105): the table keeps a width its times fit in, set in em in
  // the CSS, and scrolls sideways. Only then - a scrolling box would also stop
  // the header sticking as the page scrolls, so it is not one by default.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrolls = useMeasured(wrapperRef, (wrapper) => {
    const table = wrapper.firstElementChild as HTMLElement | null;
    if (table == null) return false;
    // The width the CSS asks for, which the layout chosen does not change.
    const needs = parseFloat(getComputedStyle(table).minWidth);
    return needs > wrapper.clientWidth + 1;
  });

  return (
    <div
      className={`MonthPrayerTable__scroller${
        scrolls ? " MonthPrayerTable__scroller--scrolls" : ""
      }`}
      ref={wrapperRef}
      data-testid="month-scroller"
    >
      <table className="MonthPrayerTable">
        <thead>
          <tr>
            <th className="MonthPrayerTable__col MonthPrayerTable__col--day" />
            <th className="MonthPrayerTable__col">Fajr</th>
            <th className="MonthPrayerTable__col">Shuruq</th>
            <th className="MonthPrayerTable__col">Duhr</th>
            <th className="MonthPrayerTable__col">Asr</th>
            <th className="MonthPrayerTable__col">Maghrib</th>
            <th className="MonthPrayerTable__col">Isha</th>
          </tr>
        </thead>
        <tbody>
          {monthData == null
            ? monthLoading
            : monthData.map((dayData, i) => (
                <tr
                  className={getClassNameForRow(i)}
                  key={i}
                  aria-current={isToday(i) ? "date" : undefined}
                >
                  <td className="MonthPrayerTable__col MonthPrayerTable__col--day">
                    <DayLabel year={year} month={month} day={i + 1} />
                  </td>
                  {dayData.map((p) => (
                    <MonthPrayerTableCol
                      prayer={p}
                      timeZone={displayTimeZone}
                      uses24={uses24}
                      key={p.time.getTime()}
                    />
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
};

export default MonthPrayerTable;
