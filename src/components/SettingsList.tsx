import React, { useState } from "react";
import {
  IonList,
  IonListHeader,
  IonLabel,
  IonItem,
  IonIcon,
  IonToggle,
  IonRange,
  IonToast,
} from "@ionic/react";
import { alarm, timer, map, sunny, bulb, moon } from "ionicons/icons";
import { PrayerLocation } from "../lib/PrayerTimeData";
import supportsHanafiAsr, { AsrMethod } from "../lib/PrayerTimes";
import { AppSettings } from "../lib/settings";
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
};
const SettingsList: React.FC<Props> = ({
  settings,
  onNotifyChange,
  onNotifyMinutesChange,
  onLocationChange,
  onAsrMethodChange,
  onDarkModeChange,
  onDarkModeMaghribChange,
}) => {
  const [testResult, setTestResult] = useState<string | null>(null);

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
      <IonToast
        isOpen={testResult !== null}
        onDidDismiss={() => setTestResult(null)}
        message={testResult ?? ""}
        duration={3000}
      />
    </IonList>
  );
};

export default SettingsList;
