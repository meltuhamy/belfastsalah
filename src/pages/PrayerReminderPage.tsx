import React from "react";
import { useParams } from "react-router";
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonAlert,
} from "@ionic/react";
import { copyOutline } from "ionicons/icons";
import { useSettings } from "../lib/useSettings";
import FullPageSpinner from "../components/FullPageSpinner";
import CenteredMaxWidthContainer from "../components/CenteredMaxWidthContainer";
import PrayerReminderEditor from "../components/PrayerReminderEditor";
import {
  describeOffsetShort,
  isPrayerKey,
  PRAYER_KEYS,
  prayerOfKey,
  PrayerReminder,
  PrayerReminders,
  remindersForAll,
} from "../lib/prayerReminders";
import { prayerToString } from "../lib/PrayerTimes";
import { usePrayerDay } from "../lib/usePrayerDay";
import { useDisplayTimeZone } from "../lib/useDisplayTimeZone";
import { useUses24Hour } from "../lib/useTimeFormat";
import { reminderTimesLine } from "../lib/reminderTimes";
import { reminderSoundLabels } from "../lib/reminderSound";
import "./PrayerReminderPage.css";

/** "Adhan 1, 5 min before", or "Off": what applying this one would give every prayer. */
function summary(reminder: PrayerReminder): string {
  if (!reminder.on) {
    return "notifications off";
  }
  return `${reminderSoundLabels[reminder.sound]}, ${describeOffsetShort(reminder.offset).toLowerCase()}`;
}

/**
 * One prayer's reminder, or every prayer's at once ("all"). Every change is
 * saved as it is made.
 */
const PrayerReminderPage: React.FC = () => {
  const { prayer } = useParams<{ prayer: string }>();
  const [settings, setSettings] = useSettings();
  const [{ today }] = usePrayerDay();
  const zone = useDisplayTimeZone();
  const twentyFourHour = useUses24Hour(settings ?? null);
  const [presentAlert] = useIonAlert();

  if (settings == null) {
    return <FullPageSpinner />;
  }

  const all = !isPrayerKey(prayer);
  const key = all ? null : prayer;
  const name = key === null ? "every prayer" : prayerToString(prayerOfKey(key));
  // "All prayers" shows what they share, and nothing chosen where they
  // differ; whatever is changed there is written to all six.
  const forAll = key === null ? remindersForAll(settings.reminders) : null;
  const value: PrayerReminder = forAll?.value ?? settings.reminders[key!];

  function change(patch: Partial<PrayerReminder>) {
    const reminders: PrayerReminders = { ...settings!.reminders };
    for (const k of key === null ? PRAYER_KEYS : [key]) {
      reminders[k] = { ...reminders[k], ...patch };
    }
    setSettings({ ...settings!, reminders });
  }

  /** Gives every prayer this one's settings, once the user has said yes. */
  function confirmApplyToAll() {
    const source = value;
    void presentAlert({
      header: "Apply to all prayers?",
      message: `Every prayer will be set like ${name}: ${summary(source)}.`,
      buttons: [
        { text: "Cancel", role: "cancel" },
        {
          text: "Apply",
          role: "confirm",
          handler: () => {
            const reminders = {} as PrayerReminders;
            for (const k of PRAYER_KEYS) {
              reminders[k] = { ...source };
            }
            // The app's own "Your settings have been saved" says it worked.
            setSettings({ ...settings!, reminders });
          },
        },
      ],
    });
  }

  const todayTime =
    key === null || today === null ? null : today[prayerOfKey(key)].time;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/settings/notifications" />
          </IonButtons>
          <IonTitle>{key === null ? "All prayers" : `${name} reminder`}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <CenteredMaxWidthContainer>
          <PrayerReminderEditor
            prayerName={key === null ? "each prayer" : name}
            switchLabel={key === null ? "Notifications" : `${name} notification`}
            value={value}
            onChange={change}
            mixed={forAll?.mixed}
            appearance={
              key === null ? undefined : { prayer: key, reminders: settings.reminders }
            }
            timesLine={
              todayTime === null
                ? null
                : (offset: number) =>
                    reminderTimesLine(name, todayTime, offset, zone, twentyFourHour)
            }
          />
          {key !== null ? (
            <div className="prayer-reminder__apply">
              <IonButton
                expand="block"
                fill="outline"
                onClick={confirmApplyToAll}
                data-testid="apply-to-all"
              >
                <IonIcon slot="start" icon={copyOutline} />
                Apply to all prayers
              </IonButton>
            </div>
          ) : null}
        </CenteredMaxWidthContainer>
      </IonContent>
    </IonPage>
  );
};

export default PrayerReminderPage;
