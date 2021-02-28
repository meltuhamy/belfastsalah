import React from "react";
import "./DayPrayerTable.css";
import { PrayerDayTimes, prayerToString } from "../lib/PrayerTimes";
import { format } from "date-fns";
import { IonProgressBar } from "@ionic/react";

type Props = {
  dayTimes: PrayerDayTimes | null;
};

const DayPrayerTable: React.FC<Props> = ({ dayTimes }) => {
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
                {format(prayerTime.time, "HH:mm")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
export default DayPrayerTable;
