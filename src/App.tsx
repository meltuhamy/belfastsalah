import React, { useContext, useEffect, useRef, useState } from "react";
import { Route } from "react-router-dom";
import { IonApp, IonRouterOutlet, IonToast } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { getDeviceTimeZone } from "./lib/timeZone";
import {
  formatClockTime,
  uses24Hour as resolveUses24Hour,
} from "./lib/timeFormat";
import { useDeviceUses24Hour } from "./lib/useTimeFormat";
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
import {
  notificationLimit,
  planReminders,
  REMINDERS_ENDED_BODY,
  REMINDERS_ENDED_TITLE,
  reminderBody,
  reminderTitle,
} from "./lib/reminderSchedule";
import { syncAndroidReminders } from "./lib/nativeReminders";
import { iosSoundName, soundForPrayer } from "./lib/reminderSound";
import { addSaveListener, removeSaveListener } from "./lib/settings";
import { refreshWidgets } from "./lib/widgets";
import FullPageSpinner from "./components/FullPageSpinner";
import SetupPage from "./pages/SetupPage";

import { setupIonicReact } from "@ionic/react";
setupIonicReact();

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
  const notifySound = settings == null ? null : settings.notifySound;
  const fajrSound = settings == null ? null : settings.fajrSound;
  // The System setting resolved against the phone's own switch, kept current
  // by the native plugin. Everything that prints a clock time reads this.
  const timeFormat = settings == null ? null : settings.timeFormat;
  const deviceUses24Hour = useDeviceUses24Hour();
  const uses24Hour = resolveUses24Hour(
    timeFormat ?? "system",
    deviceUses24Hour
  );

  // The effect below closes over one render, but a follow-up can run after
  // settings have moved on. Read these at the start of each run.
  const reminderInputs = useRef({
    location,
    showTimesInDeviceZone,
    asrMethod,
    notificationsEnabled,
    notificationMinutes,
    notifySound,
    fajrSound,
    timeFormat,
    uses24Hour,
  });
  reminderInputs.current = {
    location,
    showTimesInDeviceZone,
    asrMethod,
    notificationsEnabled,
    notificationMinutes,
    notifySound,
    fajrSound,
    timeFormat,
    uses24Hour,
  };

  const remindersInFlight = useRef<Promise<void> | null>(null);
  // Silent flag for the one follow-up, or null when nothing is waiting.
  // A second run beside the first would cancel what the first just wrote.
  const reminderRerun = useRef<boolean | null>(null);

  async function applyReminders(silent: boolean) {
    const inputs = reminderInputs.current;
    if (
      inputs.location === null ||
      inputs.asrMethod === null ||
      inputs.notificationsEnabled === null ||
      inputs.notificationMinutes === null
    ) {
      return;
    }
    const prayerTimes =
      inputs.location === PrayerLocation.London
        ? new LondonPrayerTimes(inputs.asrMethod)
        : new BelfastPrayerTimes();

    const notificationZone = inputs.showTimesInDeviceZone
      ? getDeviceTimeZone()
      : locationTimeZones[inputs.location];

    const now = new Date();

    if (Capacitor.getPlatform() === "android") {
      // The plugin's batch runs out. Android writes years of reminders and
      // rearms two days at a time, including when these are turned off.
      await syncAndroidReminders(
        {
          notify: inputs.notificationsEnabled,
          notifyMinutes: inputs.notificationMinutes,
          notifySound: inputs.notifySound ?? "default",
          fajrSound: inputs.fajrSound ?? "same",
          location: inputs.location,
          asrMethod: inputs.asrMethod,
          showTimesInDeviceZone: inputs.showTimesInDeviceZone === true,
          timeFormat: inputs.timeFormat ?? "system",
        },
        now,
        silent
      );
      return;
    }

    if (!inputs.notificationsEnabled) {
      // Scheduling is the only thing that ever cancelled, so turning
      // reminders off used to leave every already-scheduled one in place and
      // the phone kept buzzing for the next ten days. An empty list clears
      // what is pending and schedules nothing.
      await clearAndSetNotifications([], silent);
      return;
    }

    const minutesBefore = inputs.notificationMinutes;
    const sounds = {
      notifySound: inputs.notifySound ?? "default",
      fajrSound: inputs.fajrSound ?? "same",
    };
    const slots = await planReminders(
      notificationLimit(Capacitor.getPlatform()),
      minutesBefore,
      now,
      (from) => prayerTimes.getNext(from)
    );
    const notificationsToSchedule: Array<LocalNotificationSchema> = slots.map(
      (slot) => {
        if (slot.prayer === null || slot.prayerTime === null) {
          return {
            // The pending batch ends here: about ten days on iOS, which will
            // not hold more than 64. Nothing refills it until the app is opened.
            title: REMINDERS_ENDED_TITLE,
            body: REMINDERS_ENDED_BODY,
            id: slot.id,
            schedule: { at: slot.at },
            sound: iosSoundName(soundForPrayer(null, sounds)),
            actionTypeId: "",
            extra: null,
          };
        }
        return {
          // Must use the same clock the app shows, or the lock screen and
          // the app disagree about when the prayer is.
          title: reminderTitle(
            prayerToString(slot.prayer),
            // AM and PM stay in a notification, read on its own on the lock
            // screen, as in Android's titles (reminderPayload.ts).
            formatClockTime(
              slot.prayerTime,
              notificationZone,
              inputs.uses24Hour,
              { withPeriod: true }
            )
          ),
          body: reminderBody(minutesBefore),
          id: slot.id,
          schedule: { at: slot.at },
          // iOS only: Android posts its own reminders (nativeReminders.ts).
          sound: iosSoundName(soundForPrayer(slot.prayer, sounds)),
          actionTypeId: "",
          extra: null,
        };
      }
    );
    await clearAndSetNotifications(notificationsToSchedule, silent);
  }

  function scheduleReminders(silent: boolean) {
    if (remindersInFlight.current) {
      // Silent only if every request it stands for was: a settings change
      // queued behind a foreground event still gets its toast and may ask.
      reminderRerun.current = (reminderRerun.current ?? true) && silent;
      return;
    }
    remindersInFlight.current = (async () => {
      let silentRun = silent;
      try {
        do {
          reminderRerun.current = null;
          try {
            await applyReminders(silentRun);
          } catch (error) {
            console.warn("Could not schedule prayer reminders", error);
          }
          if (reminderRerun.current !== null) {
            silentRun = reminderRerun.current;
          }
        } while (reminderRerun.current !== null);
      } finally {
        remindersInFlight.current = null;
      }
    })();
  }

  useEffect(() => {
    if (
      location === null ||
      asrMethod === null ||
      notificationsEnabled === null ||
      notificationMinutes === null
    ) {
      return;
    }

    scheduleReminders(false);

    // `resume` fires for the same transition, so listening for both would
    // schedule twice. HomePage only handles the Android back button.
    const pendingHandle = CapacitorApp.addListener(
      "appStateChange",
      (state) => {
        if (!state.isActive) {
          return;
        }
        scheduleReminders(true);
      }
    );

    return () => {
      void pendingHandle.then((handle) => handle.remove());
    };
    // scheduleReminders reads the latest settings from reminderInputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    location,
    asrMethod,
    notificationsEnabled,
    notificationMinutes,
    notifySound,
    fajrSound,
    showTimesInDeviceZone,
    timeFormat,
  ]);

  // The phone's own switch changing is a refresh the user did not ask for
  // here - it arrives when they come back from the system settings, or when
  // the native read lands just after launch - so it reschedules silently:
  // no toast and no permission prompt. Only System follows the switch.
  const deviceFormatSeen = useRef(false);
  useEffect(() => {
    if (!deviceFormatSeen.current) {
      deviceFormatSeen.current = true;
      return;
    }
    if (timeFormat === "system") {
      scheduleReminders(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceUses24Hour]);

  // Same dependencies as the reminder scheduling above: anything that changes
  // which times are shown changes what the widgets should say.
  useEffect(() => {
    refreshWidgets(settings, undefined, uses24Hour);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, asrMethod, showTimesInDeviceZone, timeFormat, uses24Hour]);

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
