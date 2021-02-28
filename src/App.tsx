import React, { useContext, useEffect, useLayoutEffect, useState } from "react";
import { Route } from "react-router-dom";
import { IonApp, IonRouterOutlet, IonToast } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { format, subMinutes } from "date-fns";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";

/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";

/* Basic CSS for apps built with Ionic */
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

/* Optional CSS utils that can be commented out */
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

/* Theme variables */
import "./theme/variables.css";
import { useSettings } from "./lib/useSettings";
import { AppContext } from "./State";
import { usePrayerDay } from "./lib/usePrayerDay";
import { LocalNotification, Plugins } from "@capacitor/core";
import { useInterval } from "./lib/useInterval";
import {
  BelfastPrayerTimes,
  LondonPrayerTimes,
  Prayer,
  PrayerLocation,
  prayerToString,
} from "./lib/PrayerTimes";
import {
  addUpdateNotifyListener,
  clearAndSetNotifications,
  removeUpdateNotifyListener,
} from "./lib/notifications";
import { addSaveListener, removeSaveListener } from "./lib/settings";
import FullPageSpinner from "./components/FullPageSpinner";
import SetupPage from "./pages/SetupPage";

const MAX_NOTIFICATIONS = 64;

const App: React.FC = () => {
  const [settings, , hydrated] = useSettings();
  const { dispatch } = useContext(AppContext);
  const [{ next }] = usePrayerDay();
  const [showSettingsSavedToast, setShowSettingsSavedToast] = useState(false);
  const [
    showNotifyToast,
    setShowNotifyToast,
  ] = useState<Array<LocalNotification> | null>([]);

  // fire the ticker
  useInterval(() => {
    dispatch({ type: "setTick", payload: null });
  }, 1000);

  const nightMode = settings !== null && settings.nightMode;
  const nightModeMaghrib = settings !== null && settings.nightModeMaghrib;
  const nextPrayer = next !== null && next.prayer;

  useLayoutEffect(() => {
    if (nightMode) {
      if (nextPrayer !== false && nightModeMaghrib) {
        switch (nextPrayer) {
          case Prayer.Fajr:
          case Prayer.Shuruq:
          case Prayer.Isha:
            document.body.classList.add("dark");
            break;
          case Prayer.Duhr:
          case Prayer.Asr:
          case Prayer.Maghrib:
            document.body.classList.remove("dark");
            break;
        }
      } else {
        if (nightModeMaghrib) {
          document.body.classList.remove("dark");
        } else {
          document.body.classList.add("dark");
        }
      }
    } else {
      document.body.classList.remove("dark");
    }
  }, [nightMode, nightModeMaghrib, nextPrayer]);

  const location = settings == null ? null : settings.location;
  const asrMethod = settings == null ? null : settings.asrMethod;
  const notificationsEnabled = settings == null ? null : settings.notify;
  const notificationMinutes = settings == null ? null : settings.notifyMinutes;

  useEffect(() => {
    if (
      location === null ||
      asrMethod === null ||
      notificationsEnabled === null ||
      notificationMinutes === null
    ) {
      return;
    }
    const prayerTimes =
      location === PrayerLocation.London
        ? new LondonPrayerTimes(asrMethod)
        : new BelfastPrayerTimes();

    // clear all notifications
    async function clearAllAndSet(enabled: boolean, minutesBefore: number) {
      if (enabled) {
        const now = new Date();
        let currentPrayerTime = now;
        const notificationsToSchedule: Array<LocalNotification> = [];
        for (let i = 0; i < MAX_NOTIFICATIONS - 1; i++) {
          const currentPrayer = await prayerTimes.getNext(currentPrayerTime);
          notificationsToSchedule.push({
            title: `${prayerToString(currentPrayer.prayer)} is at ${format(
              currentPrayer.time,
              "HH:mm"
            )}`,
            body:
              minutesBefore > 0
                ? `${minutesBefore} minute reminder`
                : "Prayer time reminder",
            id: i,
            schedule: { at: subMinutes(currentPrayer.time, minutesBefore) },
            // sound: null,
            // attachments: null,
            actionTypeId: "",
            extra: null,
          });
          currentPrayerTime = currentPrayer.time;
        }
        notificationsToSchedule.push({
          title: "Still want prayer notifications?",
          body: "Tap here or open the Prayer Times app to enable",
          id: MAX_NOTIFICATIONS,
          schedule: { at: currentPrayerTime },
          actionTypeId: "",
          extra: null,
        });
        await clearAndSetNotifications(notificationsToSchedule);
      }
    }
    clearAllAndSet(notificationsEnabled, notificationMinutes);
  }, [location, asrMethod, notificationsEnabled, notificationMinutes]);

  useEffect(() => {
    function handleSavedEvent() {
      setShowSettingsSavedToast(true);
    }
    addSaveListener(handleSavedEvent);
    return function cleanup() {
      removeSaveListener(handleSavedEvent);
    };
  });

  useEffect(() => {
    function handleNotifyUpdateEvent(notifications: Array<LocalNotification>) {
      setShowNotifyToast(notifications);
    }
    addUpdateNotifyListener(handleNotifyUpdateEvent);
    return function cleanup() {
      removeUpdateNotifyListener(handleNotifyUpdateEvent);
    };
  });
  let contents = null;

  if (!hydrated) {
    contents = <FullPageSpinner />;
  } else if (!settings) {
    contents = <SetupPage />;
  } else {
    contents = (
      <IonReactRouter>
        <IonRouterOutlet>
          <Route path="/" component={HomePage} exact={true} />
          <Route path="/settings" component={SettingsPage} />
        </IonRouterOutlet>
      </IonReactRouter>
    );
  }

  return (
    <IonApp>
      {contents}
      <IonToast
        isOpen={showSettingsSavedToast}
        onDidDismiss={() => setShowSettingsSavedToast(false)}
        message="Your settings have been saved"
        duration={1000}
      />
      <IonToast
        isOpen={showNotifyToast !== null && showNotifyToast.length > 0}
        onDidDismiss={() => setShowNotifyToast(null)}
        message={
          showNotifyToast !== null && showNotifyToast.length > 0
            ? "Notifications updated"
            : ""
        }
        duration={1000}
      />
    </IonApp>
  );
};

export default App;
