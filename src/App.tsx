import React, { useContext, useEffect, useState } from "react";
import { Route } from "react-router-dom";
import { IonApp, IonRouterOutlet, IonToast } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { subMinutes } from "date-fns";
import { formatTimeInZone, getDeviceTimeZone } from "./lib/timeZone";
import { locationTimeZones } from "./lib/PrayerTimeData";
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

/* This app's own colours, which are not Ionic 8's defaults. */
import "./theme/variables.css";

/* Ionic's dark palette, applied by adding .ion-palette-dark to <html>. This
   used to be a hand-copied fork of Ionic's pre-8 dark theme.

   Imported after variables.css and not before: Ionic puts its mode class on
   <html>, so .ion-palette-dark and the :root block above land on the same
   element with equal specificity, and whichever comes last wins. The other
   order silently leaves the light palette in force in dark mode. */
import "@ionic/react/css/palettes/dark.class.css";
import { useSettings } from "./lib/useSettings";
import { AppContext } from "./State";
import { usePrayerDay } from "./lib/usePrayerDay";
import { LocalNotificationSchema } from "@capacitor/local-notifications";
import { useInterval } from "./lib/useInterval";
import {
  BelfastPrayerTimes,
  LondonPrayerTimes,
  PrayerLocation,
  prayerToString,
} from "./lib/PrayerTimes";
import { useTheme } from "./lib/useTheme";
import { Theme } from "./lib/theme";
import {
  addUpdateNotifyListener,
  clearAndSetNotifications,
  removeUpdateNotifyListener,
} from "./lib/notifications";
import { addSaveListener, removeSaveListener } from "./lib/settings";
import FullPageSpinner from "./components/FullPageSpinner";
import SetupPage from "./pages/SetupPage";

import { setupIonicReact } from "@ionic/react";
setupIonicReact();

const MAX_NOTIFICATIONS = 64;

const App: React.FC = () => {
  const [settings, , hydrated] = useSettings();
  const { dispatch } = useContext(AppContext);
  const [{ next }] = usePrayerDay();
  const [showSettingsSavedToast, setShowSettingsSavedToast] = useState(false);
  const [showNotifyToast, setShowNotifyToast] =
    useState<Array<LocalNotificationSchema> | null>([]);

  // fire the ticker
  useInterval(() => {
    dispatch({ type: "setTick", payload: null });
  }, 1000);

  // One owner of the palette. Before setup completes there are no stored
  // settings to read, so the setup screen reports its choice up here rather
  // than applying it itself - two components toggling the class would fight.
  const [setupTheme, setSetupTheme] = useState<Theme>("system");
  useTheme(
    settings?.theme ?? setupTheme,
    next === null ? null : next.prayer
  );

  const location = settings == null ? null : settings.location;
  const showTimesInDeviceZone =
    settings == null ? null : settings.showTimesInDeviceZone;
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

    const notificationZone = showTimesInDeviceZone
      ? getDeviceTimeZone()
      : locationTimeZones[location];

    // clear all notifications
    async function clearAllAndSet(enabled: boolean, minutesBefore: number) {
      if (enabled) {
        const now = new Date();
        let currentPrayerTime = now;
        const notificationsToSchedule: Array<LocalNotificationSchema> = [];
        for (let i = 0; i < MAX_NOTIFICATIONS - 1; i++) {
          const currentPrayer = await prayerTimes.getNext(currentPrayerTime);
          notificationsToSchedule.push({
            // Must use the same clock the app shows, or the lock screen and
            // the app disagree about when the prayer is.
            title: `${prayerToString(
              currentPrayer.prayer
            )} is at ${formatTimeInZone(currentPrayer.time, notificationZone)}`,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    location,
    asrMethod,
    notificationsEnabled,
    notificationMinutes,
    showTimesInDeviceZone
  ]);

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
    function handleNotifyUpdateEvent(
      notifications: Array<LocalNotificationSchema>
    ) {
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
    contents = <SetupPage onThemePreview={setSetupTheme} />;
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
