import React from "react";
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { play } from "ionicons/icons";
import { useSettings } from "../lib/useSettings";
import FullPageSpinner from "../components/FullPageSpinner";
import CenteredMaxWidthContainer from "../components/CenteredMaxWidthContainer";
import {
  commonReminder,
  describeOffsetShort,
  PRAYER_KEYS,
  prayerOfKey,
  PrayerReminder,
} from "../lib/prayerReminders";
import { prayerToString } from "../lib/PrayerTimes";
import { reminderSoundLabels } from "../lib/reminderSound";
import "./NotificationSettingsPage.css";

function soundText(reminder: PrayerReminder): string {
  return reminder.on ? reminderSoundLabels[reminder.sound] : "Off";
}

/**
 * Notification Settings: every prayer's reminder at a glance, each one a row
 * that opens its own screen, and the test day.
 */
const NotificationSettingsPage: React.FC = () => {
  const [settings] = useSettings();
  if (settings == null) {
    return <FullPageSpinner />;
  }
  const common = commonReminder(settings.reminders);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/settings" />
          </IonButtons>
          <IonTitle>Notification Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <CenteredMaxWidthContainer>
          <IonList>
            <IonItem
              routerLink="/settings/notifications/prayer/all"
              detail={true}
              data-testid="reminder-row-all"
            >
              <IonLabel>
                <h2>All prayers</h2>
                <p>Set one timing and sound for every prayer</p>
              </IonLabel>
              <IonNote slot="end" className="notification-settings__value">
                {common === null ? "Mixed" : soundText(common)}
              </IonNote>
            </IonItem>

            <IonListHeader>
              <IonLabel>Each prayer</IonLabel>
            </IonListHeader>
            {PRAYER_KEYS.map((key) => {
              const reminder = settings.reminders[key];
              return (
                <IonItem
                  key={key}
                  routerLink={`/settings/notifications/prayer/${key}`}
                  detail={true}
                  data-testid={`reminder-row-${key}`}
                >
                  <IonLabel>{prayerToString(prayerOfKey(key))}</IonLabel>
                  <div slot="end" className="notification-settings__summary">
                    <span
                      className={
                        reminder.on && reminder.sound.startsWith("adhan-")
                          ? "notification-settings__sound notification-settings__sound--adhan"
                          : "notification-settings__sound"
                      }
                    >
                      {soundText(reminder)}
                    </span>
                    {reminder.on ? (
                      <span className="notification-settings__when">
                        {describeOffsetShort(reminder.offset)}
                      </span>
                    ) : null}
                  </div>
                </IonItem>
              );
            })}
          </IonList>

          <div className="notification-settings__test">
            <IonButton
              expand="block"
              fill="outline"
              routerLink="/settings/notifications/test"
              data-testid="test-it-out"
            >
              <IonIcon slot="start" icon={play} />
              Test it out
            </IonButton>
          </div>
        </CenteredMaxWidthContainer>
      </IonContent>
    </IonPage>
  );
};

export default NotificationSettingsPage;
