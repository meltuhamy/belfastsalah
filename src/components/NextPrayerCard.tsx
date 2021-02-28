import React from "react";
import {
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonSkeletonText,
  IonCardContent,
  IonText,
} from "@ionic/react";
import { prayerToString, PrayerTime } from "../lib/PrayerTimes";
import { timeDurationString } from "../lib/dateUtils";

type Props = { next: PrayerTime | null; prev: PrayerTime | null; now: Date };
const NextPrayerCard: React.FC<Props> = ({ next, prev, now }) => {
  return (
    <IonCard color="primary">
      <IonCardHeader color="primary">
        <IonCardSubtitle className="ion-text-center">
          {next == null ? (
            <IonSkeletonText animated />
          ) : (
            <>Next: {prayerToString(next.prayer)}</>
          )}
        </IonCardSubtitle>
      </IonCardHeader>

      <IonCardContent>
        {next == null || prev == null ? (
          <>
            <IonSkeletonText animated />
            <IonSkeletonText animated />
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <IonText>
              {`${prayerToString(next.prayer)} is in ${timeDurationString(
                (next.time.getTime() - now.getTime()) / 1000,
                "long"
              )}`}
            </IonText>
            <br />
            <IonText>
              {`${prayerToString(prev.prayer)} was ${timeDurationString(
                (now.getTime() - prev.time.getTime()) / 1000,
                "long"
              )} ago`}
            </IonText>
          </div>
        )}
      </IonCardContent>
    </IonCard>
  );
};

export default NextPrayerCard;
