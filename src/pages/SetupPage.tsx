import React, { useEffect, useState } from "react";
import {
  IonHeader,
  IonToolbar,
  IonPage,
  IonTitle,
  IonContent,
  IonList,
  IonRadioGroup,
  IonListHeader,
  IonLabel,
  IonItem,
  IonRadio,
  IonText,
  IonButton,
} from "@ionic/react";
import { useSettings } from "../lib/useSettings";
import { getDefaultSettings, AppSettings } from "../lib/settings";
import supportsHanafiAsr, {
  AsrMethod,
  PrayerLocation,
} from "../lib/PrayerTimes";
import SettingsList from "../components/SettingsList";
import CenteredMaxWidthContainer from "../components/CenteredMaxWidthContainer";
import { SplashScreen } from "@capacitor/splash-screen";

const SetupPage: React.FC = () => {
  useEffect(() => {
    SplashScreen.hide();
  });
  const defaultSettings = getDefaultSettings();

  const [inputSettings, setInputSettings] = useState<AppSettings>({
    ...defaultSettings,
    location: PrayerLocation.London,
  });

  const [settingsListVisible, setSettingsListVisible] = useState(false);
  const [, setAppSettings] = useSettings();

  const setSetting = (o: Partial<AppSettings>) =>
    setInputSettings({ ...inputSettings, ...o });

  const onNext = () => {
    setSettingsListVisible(true);
  };

  const onSave = () => {
    setAppSettings(inputSettings);
  };

  const firstPage = (
    <>
      <IonList>
        <IonRadioGroup
          allowEmptySelection={false}
          value={inputSettings.location}
          onIonChange={(e) => {
            // Ionic components emit ionChange, not React's change event. Using
            // onChange here meant the selection was never stored, so the
            // controlled value snapped straight back to London.
            const newLocation = e.detail.value as PrayerLocation;
            setSetting({
              location: newLocation,
              // Belfast's timetable has no second asr column, so hanafi asr
              // has to fall back or the data parser throws.
              asrMethod: supportsHanafiAsr(newLocation)
                ? inputSettings.asrMethod
                : AsrMethod.Shafi,
            });
          }}
        >
          <IonListHeader>
            <IonLabel>Location</IonLabel>
          </IonListHeader>
          {/*
            Ionic 8 removed the legacy syntax where an ion-radio sat next to a
            sibling ion-label inside an ion-item. It no longer associates the
            two, so only the radio dot itself was clickable and tapping the row
            did nothing. The label has to live inside the control.
          */}
          <IonItem>
            <IonRadio value="london" labelPlacement="end" justify="start">
              London
            </IonRadio>
          </IonItem>
          <IonItem>
            <IonRadio value="belfast" labelPlacement="end" justify="start">
              Belfast
            </IonRadio>
          </IonItem>
        </IonRadioGroup>
      </IonList>
      <IonText color="medium">Timing is based on your device's clock.</IonText>
      <IonButton className="ion-margin-top" expand="block" onClick={onNext}>
        Next
      </IonButton>
    </>
  );

  const secondPage = (
    <>
      <SettingsList
        settings={inputSettings}
        onNotifyChange={(notify) => setSetting({ notify })}
        onNotifyMinutesChange={(notifyMinutes) => setSetting({ notifyMinutes })}
        onLocationChange={(location, asrMethod) =>
          setSetting({ location, asrMethod })
        }
        onAsrMethodChange={(asrMethod) => setSetting({ asrMethod })}
        onDarkModeChange={(nightMode) => setSetting({ nightMode })}
        onDarkModeMaghribChange={(nightModeMaghrib) =>
          setSetting({ nightModeMaghrib })
        }
      />
      <IonButton className="ion-margin-top" expand="block" onClick={onSave}>
        Done
      </IonButton>
    </>
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Set up</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent class="ion-padding">
        <CenteredMaxWidthContainer>
          {settingsListVisible ? secondPage : firstPage}
        </CenteredMaxWidthContainer>
      </IonContent>
    </IonPage>
  );
};

export default SetupPage;
