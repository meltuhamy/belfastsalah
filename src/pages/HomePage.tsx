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

let shouldExitApp = false;
App.addListener("backButton", () => {
  if (shouldExitApp) {
    App.exitApp();
  }
});

const HomePage: React.FC = () => {
  const [{ today, next, prev }] = usePrayerDay();
  const now = new Date();
  const [cardHeaderRef, inView] = useInView({
    threshold: 0,
    rootMargin: "-77px 0px 0px 0px",
  });

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const monthName = getMonthNames()[selectedMonth];

  useIonViewDidEnter(() => {
    shouldExitApp = true;
    SplashScreen.hide();
  });

  useIonViewDidLeave(() => {
    shouldExitApp = false;
  });

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
                year={now.getFullYear()}
              />
            </IonCardContent>
          </IonCard>
        </CenteredMaxWidthContainer>
      </IonContent>
    </IonPage>
  );
};

export default HomePage;
