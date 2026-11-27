import {
  IonButton,
  IonButtons,
  IonCard,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonToolbar,
} from "@ionic/react";
import React, { useState } from "react";
import { arrowBack, chevronBack, chevronForward } from "ionicons/icons";
import MonthPrayerTable from "../components/MonthPrayerTable";
import MonthPicker from "../components/MonthPicker";
import CenteredMaxWidthContainer from "../components/CenteredMaxWidthContainer";
import PageTitle from "../components/PageTitle";
import { getMonthNames } from "../lib/dateUtils";
import { getZonedDateParts } from "../lib/timeZone";
import { firstTimetableYear, timetableZoneFor } from "../lib/PrayerTimeData";
import { useSettings } from "../lib/useSettings";
import "./MonthPage.css";

type MonthAndYear = { month: number; year: number };

function step({ month, year }: MonthAndYear, by: number): MonthAndYear {
  const index = year * 12 + month + by;
  return { month: ((index % 12) + 12) % 12, year: Math.floor(index / 12) };
}

/**
 * The whole month, opened from the Month button on home (MEL-363). It opens
 * on the timetable's current month, with today highlighted; the picker
 * chooses a month of the year on show, and the arrows step a month either
 * way, across the turn of a year.
 */
const MonthPage: React.FC = () => {
  const [appSettings] = useSettings();
  // The timetable's calendar, so the page opens on the right month for
  // someone whose device is on a different date.
  const today = getZonedDateParts(
    new Date(),
    timetableZoneFor(appSettings?.location ?? null)
  );
  const [shown, setShown] = useState<MonthAndYear>({
    month: today.month - 1,
    year: today.year,
  });
  const names = getMonthNames();
  const prev = step(shown, -1);
  const next = step(shown, 1);
  // Not back past the location's first timetable: before it, the file
  // after would be shown under the wrong year.
  const firstYear =
    appSettings?.location != null
      ? firstTimetableYear(appSettings.location)
      : null;
  const canGoBack = firstYear == null || prev.year >= firstYear;

  return (
    <IonPage className="MonthPage">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton routerLink="/" routerDirection="back" aria-label="Back">
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <PageTitle>
            <span data-testid="month-title">
              {names[shown.month]} {shown.year}
            </span>
          </PageTitle>
          <IonButtons slot="end">
            <MonthPicker
              value={shown.month}
              onChange={(month) => setShown({ month, year: shown.year })}
            />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <CenteredMaxWidthContainer>
          <nav className="MonthPage__nav" aria-label="Months">
            <IonButton
              fill="clear"
              className="MonthPage__step"
              data-testid="previous-month"
              aria-label={`Previous month, ${names[prev.month]} ${prev.year}`}
              disabled={!canGoBack}
              onClick={() => setShown(prev)}
            >
              <IonIcon slot="start" icon={chevronBack} aria-hidden="true" />
              {names[prev.month]}
            </IonButton>
            <IonButton
              fill="clear"
              className="MonthPage__step"
              data-testid="next-month"
              aria-label={`Next month, ${names[next.month]} ${next.year}`}
              onClick={() => setShown(next)}
            >
              {names[next.month]}
              <IonIcon slot="end" icon={chevronForward} aria-hidden="true" />
            </IonButton>
          </nav>
          <IonCard className="MonthPage__card">
            <MonthPrayerTable month={shown.month} year={shown.year} />
          </IonCard>
        </CenteredMaxWidthContainer>
      </IonContent>
    </IonPage>
  );
};

export default MonthPage;
