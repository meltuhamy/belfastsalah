import React from "react";
import {
  IonHeader,
  IonToolbar,
  IonPage,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
} from "@ionic/react";
import { home } from "ionicons/icons";
import { useSettings } from "../lib/useSettings";
import FullPageSpinner from "../components/FullPageSpinner";
import SettingsList from "../components/SettingsList";
import { AppSettings } from "../lib/settings";
import CenteredMaxWidthContainer from "../components/CenteredMaxWidthContainer";

const SettingsTab: React.FC = () => {
  const [settings, setNewSettings] = useSettings();
  if (settings == null) {
    return <FullPageSpinner />;
  }
  const setSetting = (o: Partial<AppSettings>) =>
    setNewSettings({ ...settings, ...o });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
          <IonButtons slot="primary">
            <IonButton routerLink="/" routerDirection="back">
              <IonIcon slot="icon-only" icon={home} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <CenteredMaxWidthContainer>
          <SettingsList
            settings={settings}
            onNotifyChange={(notify) => setSetting({ notify })}
            onNotifyMinutesChange={(notifyMinutes) =>
              setSetting({ notifyMinutes })
            }
            onLocationChange={(location, asrMethod) =>
              setSetting({ location, asrMethod })
            }
            onAsrMethodChange={(asrMethod) => setSetting({ asrMethod })}
            onDarkModeChange={(nightMode) => setSetting({ nightMode })}
            onDarkModeMaghribChange={(nightModeMaghrib) =>
              setSetting({ nightModeMaghrib })
            }
          />
        </CenteredMaxWidthContainer>
      </IonContent>
    </IonPage>
  );
};

export default SettingsTab;
