import React, { useEffect, useState } from "react";
import {
  IonHeader,
  IonToolbar,
  IonPage,
  IonTitle,
  IonContent,
  IonButton,
} from "@ionic/react";
import { useSettings } from "../lib/useSettings";
import { getDefaultSettings, AppSettings } from "../lib/settings";
import { PrayerLocation } from "../lib/PrayerTimes";
import { Theme } from "../lib/theme";
import SettingsList from "../components/SettingsList";
import CenteredMaxWidthContainer from "../components/CenteredMaxWidthContainer";
import { SplashScreen } from "@capacitor/splash-screen";

type Props = {
  /**
   * Setup keeps its answers local until Done, but a theme you cannot see is
   * not a theme you can choose, so this one is reported as it changes and
   * applied straight away.
   */
  onThemePreview: (newTheme: Theme) => void;
};

const SetupPage: React.FC<Props> = ({ onThemePreview }) => {
  useEffect(() => {
    SplashScreen.hide();
  }, []);

  // Setup shows the same list the settings screen does, so there is nothing
  // here that needs its own layout - only the starting values and the button
  // that commits them.
  const [inputSettings, setInputSettings] = useState<AppSettings>(() => ({
    ...getDefaultSettings(),
    location: PrayerLocation.London,
  }));
  const [, setAppSettings] = useSettings();

  // Functional update: this screen re-renders every second off the app's
  // ticker, so reading inputSettings from the render closure left a window
  // where an update could be written on top of a stale snapshot.
  const setSetting = (o: Partial<AppSettings>) =>
    setInputSettings((previous) => ({ ...previous, ...o }));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Set up</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent class="ion-padding">
        <CenteredMaxWidthContainer>
          <SettingsList
            settings={inputSettings}
            onNotifyChange={(notify) => setSetting({ notify })}
            onNotifyMinutesChange={(notifyMinutes) =>
              setSetting({ notifyMinutes })
            }
            onLocationChange={(location, asrMethod) =>
              setSetting({ location, asrMethod })
            }
            onAsrMethodChange={(asrMethod) => setSetting({ asrMethod })}
            onThemeChange={(theme) => {
              setSetting({ theme });
              onThemePreview(theme);
            }}
            onShowTimesInDeviceZoneChange={(showTimesInDeviceZone) =>
              setSetting({ showTimesInDeviceZone, timeZoneNoticeSeen: true })
            }
          />
          <IonButton
            className="ion-margin-top"
            expand="block"
            onClick={() => setAppSettings(inputSettings)}
          >
            Done
          </IonButton>
        </CenteredMaxWidthContainer>
      </IonContent>
    </IonPage>
  );
};

export default SetupPage;
