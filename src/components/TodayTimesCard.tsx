import React from "react";
import {
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardContent,
} from "@ionic/react";
import { format } from "date-fns";
import DayPrayerTable from "./DayPrayerTable";
import { PrayerDayTimes } from "../lib/PrayerTimes";

type Props = { dayTimes: PrayerDayTimes | null; now: Date };
const TodayTimesCard: React.FC<Props> = ({ dayTimes, now }) => {
  return (
    <IonCard>
      <IonCardHeader>
        <IonCardSubtitle className="ion-text-center">
          Today: {format(now, "eee d MMM")}
        </IonCardSubtitle>
      </IonCardHeader>
      <IonCardContent>
        <DayPrayerTable dayTimes={dayTimes} />
      </IonCardContent>
    </IonCard>
  );
};

export default TodayTimesCard;
