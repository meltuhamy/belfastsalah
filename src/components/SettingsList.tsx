import React, { useEffect, useState } from "react";
import {
  IonList,
  IonListHeader,
  IonLabel,
  IonItem,
  IonIcon,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonToast,
} from "@ionic/react";
import {
  alarm,
  map,
  sunny,
  contrast,
  timeOutline,
  globeOutline,
  gridOutline,
  lockClosed,
  openOutline,
  warningOutline,
} from "ionicons/icons";
import { PrayerLocation, locationNames } from "../lib/PrayerTimeData";
import supportsHanafiAsr, { AsrMethod } from "../lib/PrayerTimes";
import { AppSettings } from "../lib/settings";
import SkyDayBar from "./SkyDayBar";
import { THEMES, Theme, themeLabels } from "../lib/theme";
import {
  TIME_FORMATS,
  TimeFormat,
  timeFormatLabels,
} from "../lib/timeFormat";
import { describeTimeZone, getDeviceTimeZone } from "../lib/timeZone";
import { zoneChoiceApplies } from "../lib/displayZone";
import LocationSelector from "./LocationSelector";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  sendTestNotification,
  TEST_NOTIFICATION_DELAY_SECONDS,
} from "../lib/notifications";
import AdhanIcon from "./AdhanIcon";
import {
  isBatteryRestricted,
  openBatteryOptimizationSettings,
  openWidgetSettings,
  widgetSettingsRoute,
} from "../lib/widgets";
import { useLongPress } from "../lib/useLongPress";
import "./SettingsList.css";

type Props = {
  settings: AppSettings;
  onNotifyChange: (newNotify: boolean) => void;
  /**
   * Where the Notification Settings row goes. Left out on the setup screen,
   * which keeps its answers local until Done: reminders start on the
   * defaults there and are changed from settings.
   */
  notificationSettingsHref?: string;
  onLocationChange: (newLocation: PrayerLocation, asrMethod: AsrMethod) => void;
  onAsrMethodChange: (newAsrMethod: AsrMethod) => void;
  onThemeChange: (newTheme: Theme) => void;
  onTimeFormatChange: (newTimeFormat: TimeFormat) => void;
  onShowTimesInDeviceZoneChange: (newShowTimesInDeviceZone: boolean) => void;
};
const SettingsList: React.FC<Props> = ({
  settings,
  onNotifyChange,
  notificationSettingsHref,
  onLocationChange,
  onAsrMethodChange,
  onThemeChange,
  onTimeFormatChange,
  onShowTimesInDeviceZoneChange,
}) => {
  const [testResult, setTestResult] = useState<string | null>(null);
  const [exactAlarmsOff, setExactAlarmsOff] = useState(false);
  const [batteryRestricted, setBatteryRestricted] = useState(false);


  // Only worth offering when the two clocks actually differ.
  const now = new Date();
  const deviceTimeZone = getDeviceTimeZone();
  const showZoneChoice = zoneChoiceApplies(settings.location, now);

  // From API 33 the app holds USE_EXACT_ALARM, which cannot be turned off,
  // so the exact-alarm row rarely shows. On Android 12 and 12L the same
  // switch is revocable. Battery optimisation is a separate switch and is on
  // for a new install. Stock Android still delivers these reminders on time
  // while that switch is on (they are setExactAndAllowWhileIdle); some
  // manufacturers do not. Coming back to the app re-reads both, so a row
  // disappears once it is allowed.
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") {
      return;
    }

    let cancelled = false;

    async function refresh() {
      try {
        const status = await LocalNotifications.checkExactNotificationSetting();
        if (!cancelled) {
          setExactAlarmsOff(status.exact_alarm !== "granted");
        }
      } catch (error) {
        console.warn("Could not check exact alarms", error);
      }

      try {
        const restricted = await isBatteryRestricted();
        if (!cancelled) {
          setBatteryRestricted(restricted);
        }
      } catch (error) {
        console.warn("Could not check battery optimisation", error);
      }
    }

    void refresh();

    const pendingHandle = CapacitorApp.addListener(
      "appStateChange",
      (state) => {
        if (state.isActive) {
          void refresh();
        }
      }
    );

    return () => {
      cancelled = true;
      void pendingHandle.then((handle) => handle.remove());
    };
  }, []);

  async function openExactAlarmSettings() {
    try {
      const status = await LocalNotifications.changeExactNotificationSetting();
      setExactAlarmsOff(status.exact_alarm !== "granted");
    } catch (error) {
      console.warn("Could not open Alarms & reminders", error);
    }
  }

  async function openBatterySettings() {
    try {
      await openBatteryOptimizationSettings();
    } catch (error) {
      console.warn("Could not open battery optimisation", error);
    }
  }

  // Hidden diagnostic: long-press the timer icon to fire a notification a few
  // seconds out, so the whole reminder path can be checked without waiting for
  // a prayer time.
  const testNotificationPress = useLongPress(async () => {
    const result = await sendTestNotification();
    setTestResult(
      result === "scheduled"
        ? `Test notification in ${TEST_NOTIFICATION_DELAY_SECONDS} seconds`
        : "Notifications are blocked. Enable them in system settings."
    );
  });

  return (
    <IonList>
      <IonListHeader>
        <IonLabel>Prayer time settings</IonLabel>
      </IonListHeader>
      <IonItem>
        <IonIcon icon={map} slot="start" />
        <LocationSelector
          location={settings.location}
          asrMethod={settings.asrMethod}
          onChange={onLocationChange}
        />
      </IonItem>
      {settings.location !== null && supportsHanafiAsr(settings.location) && (
        <IonItem>
          <IonIcon icon={sunny} slot="start" />
          <IonToggle
            checked={settings.asrMethod === AsrMethod.Hanafi}
            onIonChange={(e) => {
              const nowChecked = e.detail.checked;
              onAsrMethodChange(
                nowChecked ? AsrMethod.Hanafi : AsrMethod.Shafi
              );
            }}
          >
            Use Hanafi Asr
          </IonToggle>
        </IonItem>
      )}
      {showZoneChoice && settings.location !== null && (
        <>
          {/*
            IonSelect is a direct child of the item on purpose. Wrapping it in
            a layout div takes it out of Ionic's item association, which leaves
            only the control's own text clickable and the rest of the row dead
            - the same Ionic 8 regression that broke the location picker twice.
            The explanation therefore sits in its own row rather than beside it.
          */}
          <IonItem>
            <IonIcon icon={globeOutline} slot="start" />
            <IonSelect
              label="Show times in"
              value={settings.showTimesInDeviceZone}
              interface="alert"
              okText="Choose"
              cancelText="Cancel"
              data-testid="display-zone-select"
              onIonChange={(event) =>
                onShowTimesInDeviceZoneChange(event.detail.value as boolean)
              }
            >
              <IonSelectOption value={false}>
                {locationNames[settings.location]} time
              </IonSelectOption>
              <IonSelectOption value={true}>My clock</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem lines="none" className="settings-list__note-item">
            <IonLabel className="ion-text-wrap">
              <p className="settings-list__note">
                Your device is on {describeTimeZone(deviceTimeZone, now)}.
                Reminders arrive at the same moment either way — this only
                changes the clock you read them on.
              </p>
            </IonLabel>
          </IonItem>
        </>
      )}
      <IonListHeader>
        <IonLabel>Notifications</IonLabel>
      </IonListHeader>
      <IonItem>
        {/*
          The long-press diagnostic lives on this icon: hold it to fire a test
          notification a few seconds out. No affordance by design.
        */}
        <span
          slot="start"
          className="settings-list__test-target"
          data-testid="notify-test-target"
          {...testNotificationPress}
        >
          <IonIcon icon={alarm} />
        </span>
        <IonToggle
          checked={settings.notify}
          onIonChange={() => {
            const newValue = !settings.notify;
            if (newValue) {
              LocalNotifications.requestPermissions().then((response) => {
                if (response.display === "granted") {
                  onNotifyChange(newValue);
                }
              });
            } else {
              onNotifyChange(newValue);
            }
          }}
        >
          Prayer Notifications
        </IonToggle>
      </IonItem>
      {settings.notify && notificationSettingsHref !== undefined && (
        <IonItem
          routerLink={notificationSettingsHref}
          detail={true}
          data-testid="notification-settings-row"
        >
          <span slot="start" className="settings-list__adhan-icon">
            <AdhanIcon />
          </span>
          <IonLabel>
            <h2>Notification Settings</h2>
            <p>When and how each prayer reminds you</p>
          </IonLabel>
        </IonItem>
      )}
      {settings.notify && exactAlarmsOff && (
        <IonItem
          button
          detail
          color="warning"
          data-testid="exact-alarm-warning"
          onClick={() => {
            void openExactAlarmSettings();
          }}
        >
          <IonIcon icon={warningOutline} slot="start" />
          <IonLabel className="ion-text-wrap">
            <h2 className="settings-list__warning-title">
              Reminders may not arrive on time
            </h2>
            <p>
              Alarms &amp; reminders is off, so prayer reminders can arrive
              late or not at all. Tap to open Alarms &amp; reminders.
            </p>
          </IonLabel>
        </IonItem>
      )}
      {settings.notify && batteryRestricted && (
        <IonItem
          button
          detail
          color="warning"
          data-testid="battery-optimisation-warning"
          onClick={() => {
            void openBatterySettings();
          }}
        >
          <IonIcon icon={warningOutline} slot="start" />
          <IonLabel className="ion-text-wrap">
            <h2 className="settings-list__warning-title">
              Battery saving may stop reminders
            </h2>
            <p>
              Battery optimisation is on for this app. Some phones delay or
              stop reminders while it is. Tap to open Battery optimisation.
            </p>
          </IonLabel>
        </IonItem>
      )}

      <IonListHeader>
        <IonLabel>Appearance</IonLabel>
      </IonListHeader>
      <IonItem>
        <IonIcon icon={contrast} slot="start" />
        <IonSelect
          label="Theme"
          value={settings.theme}
          interface="alert"
          okText="Choose"
          cancelText="Cancel"
          data-testid="theme-select"
          onIonChange={(event) => onThemeChange(event.detail.value as Theme)}
        >
          {THEMES.map((theme) => (
            <IonSelectOption key={theme} value={theme}>
              {themeLabels[theme]}
            </IonSelectOption>
          ))}
        </IonSelect>
      </IonItem>
      {settings.theme === "sky" && (
        <IonItem className="settings-list__note-item">
          <IonLabel className="ion-text-wrap settings-list__sky">
            <SkyDayBar />
            <p>
              Colours follow today's prayer times: dawn at Fajr, sunset at
              Maghrib, dark until Shuruq.
            </p>
          </IonLabel>
        </IonItem>
      )}
      <IonItem>
        <IonIcon icon={timeOutline} slot="start" />
        <IonSelect
          label="Time format"
          value={settings.timeFormat}
          interface="alert"
          okText="Choose"
          cancelText="Cancel"
          data-testid="time-format-select"
          onIonChange={(event) =>
            onTimeFormatChange(event.detail.value as TimeFormat)
          }
        >
          {TIME_FORMATS.map((format) => (
            <IonSelectOption key={format} value={format}>
              {timeFormatLabels[format]}
            </IonSelectOption>
          ))}
        </IonSelect>
      </IonItem>
      {widgetSettingsRoute() === "screen" && (
        <IonItem
          button={true}
          detail={true}
          onClick={() => openWidgetSettings()}
          data-testid="widget-settings-link"
        >
          <IonIcon icon={gridOutline} slot="start" />
          <IonLabel>
            <h3>Widget appearance</h3>
            <p>Colours and countdown for each home screen widget</p>
          </IonLabel>
        </IonItem>
      )}
      {widgetSettingsRoute() === "edit-widget" && (
        <IonItem data-testid="widget-settings-tip">
          <IonIcon icon={gridOutline} slot="start" />
          <IonLabel className="ion-text-wrap">
            <h3>Widget appearance</h3>
            <p>Touch and hold a widget, then choose Edit Widget</p>
          </IonLabel>
        </IonItem>
      )}

      <IonListHeader>
        <IonLabel>About</IonLabel>
      </IonListHeader>
      {/*
        IonItem with href renders an anchor, so the whole row is the link.
        target="_blank" is what tells Capacitor to hand the URL to the system
        browser rather than navigating the app's own webview away from itself,
        which it cannot come back from.
      */}
      <IonItem
        href="https://meltuhamy.com/privacy-policy/"
        target="_blank"
        rel="noopener noreferrer"
        detail={false}
        data-testid="privacy-policy-link"
      >
        <IonIcon icon={lockClosed} slot="start" />
        <IonLabel>
          <h3>Privacy policy</h3>
          {/*
            Accurate as written: the app makes no network requests at all, has
            no analytics or crash reporting, and ships its prayer data in the
            bundle. Settings and reminders stay on the device.
          */}
          <p>No data leaves your device</p>
        </IonLabel>
        <IonIcon icon={openOutline} slot="end" size="small" />
      </IonItem>

      <IonToast
        data-testid="test-notification-toast"
        isOpen={testResult !== null}
        onDidDismiss={() => setTestResult(null)}
        message={testResult ?? ""}
        duration={3000}
      />
    </IonList>
  );
};

export default SettingsList;
