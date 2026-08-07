import React from "react";
import {
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardContent,
} from "@ionic/react";
import { formatDateInZone } from "../lib/timeZone";
import { useDisplayTimeZone } from "../lib/useDisplayTimeZone";
import { showsForeignZone } from "../lib/displayZone";
import { useSettings } from "../lib/useSettings";
import { locationNames } from "../lib/PrayerTimeData";
import DayPrayerTable from "./DayPrayerTable";
import { PrayerDayTimes } from "../lib/PrayerTimes";
import "./TodayTimesCard.css";

type Props = { dayTimes: PrayerDayTimes | null; now: Date };
const TodayTimesCard: React.FC<Props> = ({ dayTimes, now }) => {
  const timeZone = useDisplayTimeZone();
  const [settings] = useSettings();
  // A standing reminder that these are not the numbers on the phone's own
  // clock. Only shown while that is true, so it stays meaningful rather than
  // becoming furniture everyone reads past. The caption can only appear when
  // the timetable's own zone is on screen, so it is always named after the
  // location rather than the zone - "London time" beats "British Summer Time".
  const showsOtherZone = showsForeignZone(settings, now);
  return (
    <IonCard>
      <IonCardHeader>
        <IonCardSubtitle className="ion-text-center">
          Today: {formatDateInZone(now, timeZone)}
        </IonCardSubtitle>
        {showsOtherZone && settings?.location != null && (
          <IonCardSubtitle
            className="ion-text-center TodayTimesCard__zone"
            data-testid="display-zone-caption"
          >
            Showing {locationNames[settings.location]} time
          </IonCardSubtitle>
        )}
      </IonCardHeader>
      <IonCardContent>
        <DayPrayerTable dayTimes={dayTimes} />
      </IonCardContent>
    </IonCard>
  );
};

export default TodayTimesCard;
