import {
  IonContent,
  IonHeader,
  IonPage,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  useIonViewDidEnter,
  useIonViewDidLeave,
} from "@ionic/react";
import React, { useState } from "react";
import { usePrayerDay } from "../lib/usePrayerDay";
import { settings } from "ionicons/icons";
import "./HomePage.css";
import NextDaysCard from "../components/NextDaysCard";
import PrayerDayCard from "../components/PrayerDayCard";
import CenteredMaxWidthContainer from "../components/CenteredMaxWidthContainer";
import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { shouldPromptForZone } from "../lib/displayZone";
import { locationNames } from "../lib/PrayerTimeData";
import { useSettings } from "../lib/useSettings";
import TimeZoneNotice from "../components/TimeZoneNotice";
import KeepAwakeButton from "../components/KeepAwakeButton";
import PageTitle from "../components/PageTitle";

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

  // The toolbar's shadow is there to separate it from content passing beneath
  // it, so it only earns its place once something is. Resting at the top it is
  // a line under a title with nothing on the other side of it.
  const [scrolled, setScrolled] = useState(false);

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

  // The lantern beside the cog: keeps the screen on while the app is open,
  // for reading the times across a room or following the countdown to the
  // adhan. It says so itself once on, so the save is quiet - the usual
  // "settings saved" toast would only repeat it.
  const keepAwake = appSettings?.keepAwake ?? false;
  const toggleKeepAwake = () => {
    if (appSettings == null) {
      return;
    }
    setAppSettings({ ...appSettings, keepAwake: !keepAwake }, { quiet: true });
  };

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
      <IonHeader className={scrolled ? undefined : "ion-no-border"}>
        <IonToolbar>
          <PageTitle>Prayer Times</PageTitle>
          <IonButtons slot="primary">
            <KeepAwakeButton on={keepAwake} onToggle={toggleKeepAwake} />
            <IonButton routerLink="/settings" aria-label="Settings">
              <IonIcon slot="icon-only" icon={settings} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent
        scrollEvents={true}
        onIonScroll={(event) => setScrolled(event.detail.scrollTop > 0)}
      >
        <CenteredMaxWidthContainer className="HomePage__container">
          {noticeLocation !== null && (
            <TimeZoneNotice
              locationName={locationNames[noticeLocation]}
              onUseDeviceZone={() => answerNotice(true)}
              onDismiss={() => answerNotice(false)}
            />
          )}
          {/*
            Side by side in a phone's landscape (HomePage.css); one column
            everywhere else, the tablet's included.
          */}
          <div className="HomePage__cards">
            <div className="HomePage__day">
              <PrayerDayCard today={today} next={next} prev={prev} now={now} />
            </div>
            <div className="HomePage__week">
              <NextDaysCard />
            </div>
          </div>
        </CenteredMaxWidthContainer>
      </IonContent>
    </IonPage>
  );
};

export default HomePage;
