import React, { useState, useEffect, useContext } from "react";
import { format } from "date-fns";
import {
  PrayerTime,
  PrayerLocation,
  LondonPrayerTimes,
  BelfastPrayerTimes,
  PrayerDayTimes,
  Prayer,
  AsrMethod,
} from "../lib/PrayerTimes";
import { AppContext } from "../State";
import { IonSkeletonText } from "@ionic/react";
import "./MonthPrayerTable.css";

const MonthPrayerTableCol: React.FC<{ prayer: PrayerTime }> = ({ prayer }) => {
  return (
    <td className="MonthPrayerTable__col">{format(prayer.time, "HH:mm")}</td>
  );
};

type Props = { month: number; year: number };

const MonthPrayerTable: React.FC<Props> = ({ month, year }) => {
  const { state } = useContext(AppContext);
  const now = state.tick;
  const nowMonth = now.getMonth();
  const nowDate = now.getDate();
  const getClassNameForRow = (i: number) => {
    return month === nowMonth && i + 1 === nowDate
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
      const times =
        location === PrayerLocation.London
          ? new LondonPrayerTimes(asrMethod)
          : new BelfastPrayerTimes();

      times.getMonth(month, year).then((data) => {
        setMonthData(data);
      });
    }
  }, [month, year, location, asrMethod]);

  const monthLoading = Array.from({ length: 30 }).map((_, index) => (
    <tr className="MonthPrayerTable__row" key={index}>
      <td className="MonthPrayerTable__col MonthPrayerTable__col--day">
        {index + 1}
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
  return (
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
              <tr className={getClassNameForRow(i)} key={i}>
                <td className="MonthPrayerTable__col MonthPrayerTable__col--day">
                  {dayData[Prayer.Fajr].time.getDate()}
                </td>
                {dayData.map((p) => (
                  <MonthPrayerTableCol prayer={p} key={p.time.getTime()} />
                ))}
              </tr>
            ))}
      </tbody>
    </table>
  );
};

export default MonthPrayerTable;
