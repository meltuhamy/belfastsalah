import React, { useState } from "react";
import {
  IonList,
  IonListHeader,
  IonLabel,
  IonItem,
  IonIcon,
  IonToggle,
  IonRange,
  IonSelect,
  IonSelectOption,
  IonToast,
} from "@ionic/react";
import {
  alarm,
  timer,
  map,
  sunny,
  bulb,
  moon,
  globeOutline,
  lockClosed,
  openOutline,
} from "ionicons/icons";
import { PrayerLocation, locationNames } from "../lib/PrayerTimeData";
import supportsHanafiAsr, { AsrMethod } from "../lib/PrayerTimes";
import { AppSettings } from "../lib/settings";
import { describeTimeZone, getDeviceTimeZone } from "../lib/timeZone";
import { zoneChoiceApplies } from "../lib/displayZone";
import LocationSelector from "./LocationSelector";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  sendTestNotification,
  TEST_NOTIFICATION_DELAY_SECONDS,
} from "../lib/notifications";
import { describeNotifyMinutes } from "../lib/notifyText";
import { useLongPress } from "../lib/useLongPress";
import "./SettingsList.css";

type Props = {
  settings: AppSettings;
  onNotifyChange: (newNotify: boolean) => void;
  onNotifyMinutesChange: (newNotifyMinutes: number) => void;
  onLocationChange: (newLocation: PrayerLocation, asrMethod: AsrMethod) => void;
  onAsrMethodChange: (newAsrMethod: AsrMethod) => void;
  onDarkModeChange: (newDarkMode: boolean) => void;
  onDarkModeMaghribChange: (newDarkModeMaghrib: boolean) => void;
  onShowTimesInDeviceZoneChange: (newShowTimesInDeviceZone: boolean) => void;
};
const SettingsList: React.FC<Props> = ({
  settings,
  onNotifyChange,
  onNotifyMinutesChange,
  onLocationChange,
  onAsrMethodChange,
  onDarkModeChange,
  onDarkModeMaghribChange,
  onShowTimesInDeviceZoneChange,
}) => {
  const [testResult, setTestResult] = useState<string | null>(null);

  // Only worth offering when the two clocks actually differ.
  const now = new Date();
  const deviceTimeZone = getDeviceTimeZone();
  const showZoneChoice = zoneChoiceApplies(settings.location, now);

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
        <IonIcon icon={alarm} slot="start" />
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
          Notify before prayer
        </IonToggle>
      </IonItem>
      {settings.notify && (
        <IonItem>
          <span
            slot="start"
            className="settings-list__test-target"
            data-testid="notify-test-target"
            {...testNotificationPress}
          >
            <IonIcon icon={timer} />
          </span>
          <div className="settings-list__range">
            {/*
              The label is rendered here rather than passed to IonRange so it
              can be styled: Ionic's stacked label renders small and low
              contrast inside shadow DOM, which is hard to read at a glance.
            */}
            <p className="settings-list__range-label">
              {describeNotifyMinutes(settings.notifyMinutes)}
            </p>
            <IonRange
              aria-label="Minutes before prayer"
              min={0}
              max={20}
              step={1}
              snaps={true}
              pin={true}
              pinFormatter={(value: number) => `${value}m`}
              value={settings.notifyMinutes}
              onIonChange={(event) => {
                const newValue = event.detail.value;
                onNotifyMinutesChange(newValue as number);
              }}
            ></IonRange>
          </div>
        </IonItem>
      )}

      <IonListHeader>
        <IonLabel>Dark mode</IonLabel>
      </IonListHeader>
      <IonItem>
        <IonIcon icon={bulb} slot="start" />
        <IonToggle
          checked={settings.nightMode}
          onIonChange={() => {
            onDarkModeChange(!settings.nightMode);
          }}
        >
          Use dark mode
        </IonToggle>
      </IonItem>
      {settings.nightMode && (
        <IonItem>
          <IonIcon icon={moon} slot="start" />
          <IonToggle
            checked={settings.nightModeMaghrib}
            onIonChange={() => {
              onDarkModeMaghribChange(!settings.nightModeMaghrib);
            }}
          >
            Enable at Maghrib
          </IonToggle>
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
