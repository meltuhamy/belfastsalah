import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardContent,
  IonButtons,
  IonButton,
  IonIcon,
  useIonViewDidEnter,
  useIonViewDidLeave,
} from "@ionic/react";
import React, { useState } from "react";
import { usePrayerDay } from "../lib/usePrayerDay";
import { getMonthNames } from "../lib/dateUtils";
import MonthPrayerTable from "../components/MonthPrayerTable";
import { settings } from "ionicons/icons";
import { useInView } from "react-intersection-observer";
import "./HomePage.css";
import MonthPicker from "../components/MonthPicker";
import NextPrayerCard from "../components/NextPrayerCard";
import TodayTimesCard from "../components/TodayTimesCard";
import CenteredMaxWidthContainer from "../components/CenteredMaxWidthContainer";
import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { getZonedDateParts, UK_TIME_ZONE } from "../lib/timeZone";
import { shouldPromptForZone } from "../lib/displayZone";
import { locationNames } from "../lib/PrayerTimeData";
import { useSettings } from "../lib/useSettings";
import TimeZoneNotice from "../components/TimeZoneNotice";

let shouldExitApp = false;
App.addListener("backButton", () => {
  if (shouldExitApp) {
    App.exitApp();
  }
});

const HomePage: React.FC = () => {
  const [{ today, next, prev }] = usePrayerDay();
  const [appSettings, setAppSettings] = useSettings();
  const now = new Date();
  const [cardHeaderRef, inView] = useInView({
    threshold: 0,
    rootMargin: "-77px 0px 0px 0px",
  });

  // Month and year come from the timetable's calendar, so the table opens on
  // the right page for someone whose device is on a different date.
  const ukToday = getZonedDateParts(now, UK_TIME_ZONE);
  const [selectedMonth, setSelectedMonth] = useState(ukToday.month - 1);
  const monthName = getMonthNames()[selectedMonth];

  useIonViewDidEnter(() => {
    shouldExitApp = true;
    SplashScreen.hide();
  });

  useIonViewDidLeave(() => {
    shouldExitApp = false;
  });

  // Asked once, and only of people it can affect: the times on screen are the
  // timetable's, so someone whose phone is on another clock needs telling
  // before they read them as local. Either answer settles it for good.
  const noticeLocation =
    shouldPromptForZone(appSettings, now) && appSettings?.location != null
      ? appSettings.location
      : null;

  const answerNotice = (showTimesInDeviceZone: boolean) => {
    if (appSettings == null) {
      return;
    }
    setAppSettings({
      ...appSettings,
      showTimesInDeviceZone,
      timeZoneNoticeSeen: true,
    });
  };

  return (
    <IonPage className="HomePage">
      <IonHeader>
        <IonToolbar>
          <IonTitle>{inView ? "Prayer Times" : monthName}</IonTitle>
          <IonButtons slot="primary">
            <IonButton routerLink="/settings">
              <IonIcon slot="icon-only" icon={settings} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <CenteredMaxWidthContainer>
          {noticeLocation !== null && (
            <TimeZoneNotice
              locationName={locationNames[noticeLocation]}
              onUseDeviceZone={() => answerNotice(true)}
              onDismiss={() => answerNotice(false)}
            />
          )}
          <NextPrayerCard next={next} prev={prev} now={now} />
          <TodayTimesCard now={now} dayTimes={today} />
          <IonCard className="HomePage__month-card">
            <IonCardHeader ref={cardHeaderRef}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <IonCardSubtitle>{monthName}</IonCardSubtitle>
                </div>
                <div>
                  <MonthPicker
                    now={now}
                    value={selectedMonth}
                    onChange={(newMonth) => setSelectedMonth(newMonth)}
                  />
                </div>
              </div>
            </IonCardHeader>
            <IonCardContent className="HomePage__month-card__content">
              <MonthPrayerTable
                month={selectedMonth}
                year={ukToday.year}
              />
            </IonCardContent>
          </IonCard>
        </CenteredMaxWidthContainer>
      </IonContent>
    </IonPage>
  );
};

export default HomePage;
