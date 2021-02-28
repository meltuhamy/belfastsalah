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
import { PrayerLocation } from "../lib/PrayerTimes";
import SettingsList from "../components/SettingsList";
import CenteredMaxWidthContainer from "../components/CenteredMaxWidthContainer";
import { Plugins } from "@capacitor/core";
const { SplashScreen } = Plugins;

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
          onChange={(e) => setSetting({ location: e.currentTarget.value })}
        >
          <IonListHeader>
            <IonLabel>Location</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonLabel>London</IonLabel>
            <IonRadio slot="start" value="london" />
          </IonItem>
          <IonItem>
            <IonLabel>Belfast</IonLabel>
            <IonRadio slot="start" value="belfast" />
          </IonItem>
        </IonRadioGroup>
      </IonList>
      <IonText color="medium">Timing is based on your device's clock.</IonText>
      <IonButton class="ion-margin-top" expand="block" onClick={onNext}>
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
      <IonButton class="ion-margin-top" expand="block" onClick={onSave}>
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
