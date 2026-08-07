import React from "react";
import {
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardContent,
} from "@ionic/react";
import { formatDateInZone } from "../lib/timeZone";
import { useDisplayTimeZone } from "../lib/useDisplayTimeZone";
import DayPrayerTable from "./DayPrayerTable";
import { PrayerDayTimes } from "../lib/PrayerTimes";

type Props = { dayTimes: PrayerDayTimes | null; now: Date };
const TodayTimesCard: React.FC<Props> = ({ dayTimes, now }) => {
  const timeZone = useDisplayTimeZone();
  return (
    <IonCard>
      <IonCardHeader>
        <IonCardSubtitle className="ion-text-center">
          Today: {formatDateInZone(now, timeZone)}
        </IonCardSubtitle>
      </IonCardHeader>
      <IonCardContent>
        <DayPrayerTable dayTimes={dayTimes} />
      </IonCardContent>
    </IonCard>
  );
};

export default TodayTimesCard;
