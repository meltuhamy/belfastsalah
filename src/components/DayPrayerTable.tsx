import React from "react";
import "./DayPrayerTable.css";
import { PrayerDayTimes, prayerToString } from "../lib/PrayerTimes";
import { IonProgressBar } from "@ionic/react";
import { formatTimeInZone } from "../lib/timeZone";
import { useDisplayTimeZone } from "../lib/useDisplayTimeZone";

type Props = {
  dayTimes: PrayerDayTimes | null;
};

const DayPrayerTable: React.FC<Props> = ({ dayTimes }) => {
  const timeZone = useDisplayTimeZone();
  if (dayTimes == null) {
    return <IonProgressBar type="indeterminate" />;
  }
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <table className="DayPrayerTable">
        <tbody>
          {dayTimes.map((prayerTime) => (
            <tr key={prayerTime.time.getTime()}>
              <td className="DayPrayerTable__col--prayer">
                {prayerToString(prayerTime.prayer)}
              </td>
              <td className="DayPrayerTable__col--time">
                {formatTimeInZone(prayerTime.time, timeZone)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
export default DayPrayerTable;
