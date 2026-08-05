import React from "react";
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
} from "@ionic/react";
import { alarm, timer, map, sunny, bulb, moon } from "ionicons/icons";
import { PrayerLocation } from "../lib/PrayerTimeData";
import supportsHanafiAsr, { AsrMethod } from "../lib/PrayerTimes";
import { AppSettings } from "../lib/settings";
import { LocalNotifications } from "@capacitor/local-notifications";

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
  return (
    <IonList>
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
          <IonIcon icon={timer} slot="start" />
          <IonRange
            label={`Notify ${settings.notifyMinutes} minutes before prayer`}
            labelPlacement="stacked"
            min={0}
            max={20}
            step={1}
            value={settings.notifyMinutes}
            onIonChange={(event) => {
              const newValue = event.detail.value;
              onNotifyMinutesChange(newValue as number);
            }}
          ></IonRange>
        </IonItem>
      )}

      <IonListHeader>
        <IonLabel>Prayer time settings</IonLabel>
      </IonListHeader>
      <IonItem>
        <IonIcon icon={map} slot="start" />
        <IonSelect
          label="Location"
          value={settings.location}
          onIonChange={(event) => {
            const newValue = event.detail.value as PrayerLocation;
            onLocationChange(
              newValue,
              supportsHanafiAsr(newValue) ? settings.asrMethod : AsrMethod.Shafi
            );
          }}
        >
          <IonSelectOption value="london">London</IonSelectOption>
          <IonSelectOption value="belfast">Belfast</IonSelectOption>
        </IonSelect>
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
    </IonList>
  );
};

export default SettingsList;
