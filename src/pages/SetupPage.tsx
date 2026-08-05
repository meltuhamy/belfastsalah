import React, { useEffect, useState } from "react";
import {
  IonHeader,
  IonToolbar,
  IonPage,
  IonTitle,
  IonContent,
  IonList,
  IonListHeader,
  IonLabel,
  IonItem,
  IonIcon,
  IonText,
  IonButton,
} from "@ionic/react";
import { map } from "ionicons/icons";
import { useSettings } from "../lib/useSettings";
import { getDefaultSettings, AppSettings } from "../lib/settings";
import { PrayerLocation } from "../lib/PrayerTimes";
import SettingsList from "../components/SettingsList";
import LocationSelector from "../components/LocationSelector";
import CenteredMaxWidthContainer from "../components/CenteredMaxWidthContainer";
import { SplashScreen } from "@capacitor/splash-screen";

const SetupPage: React.FC = () => {
  useEffect(() => {
    SplashScreen.hide();
  }, []);
  const defaultSettings = getDefaultSettings();

  const [inputSettings, setInputSettings] = useState<AppSettings>({
    ...defaultSettings,
    location: PrayerLocation.London,
  });

  const [settingsListVisible, setSettingsListVisible] = useState(false);
  const [, setAppSettings] = useSettings();

  // Functional update: this screen re-renders every second off the app's
  // ticker, so reading inputSettings from the render closure left a window
  // where an update could be written on top of a stale snapshot.
  const setSetting = (o: Partial<AppSettings>) =>
    setInputSettings((previous) => ({ ...previous, ...o }));

  const onNext = () => {
    setSettingsListVisible(true);
  };

  const onSave = () => {
    setAppSettings(inputSettings);
  };

  const firstPage = (
    <>
      <IonList>
        <IonListHeader>
          <IonLabel>Location</IonLabel>
        </IonListHeader>
        {/*
          The same control the settings screen uses, rather than a second
          hand-rolled picker. See LocationSelector for why.
        */}
        <IonItem>
          <IonIcon icon={map} slot="start" />
          <LocationSelector
            location={inputSettings.location}
            asrMethod={inputSettings.asrMethod}
            onChange={(location, asrMethod) =>
              setSetting({ location, asrMethod })
            }
          />
        </IonItem>
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
