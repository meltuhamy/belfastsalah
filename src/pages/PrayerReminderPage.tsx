import React from "react";
import { useParams } from "react-router";
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useSettings } from "../lib/useSettings";
import FullPageSpinner from "../components/FullPageSpinner";
import CenteredMaxWidthContainer from "../components/CenteredMaxWidthContainer";
import PrayerReminderEditor from "../components/PrayerReminderEditor";
import {
  commonReminder,
  isPrayerKey,
  PRAYER_KEYS,
  prayerOfKey,
  PrayerReminder,
  PrayerReminders,
} from "../lib/prayerReminders";
import { prayerToString } from "../lib/PrayerTimes";
import { usePrayerDay } from "../lib/usePrayerDay";
import { useDisplayTimeZone } from "../lib/useDisplayTimeZone";
import { useUses24Hour } from "../lib/useTimeFormat";
import { reminderTimesLine } from "../lib/reminderTimes";

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

  if (settings == null) {
    return <FullPageSpinner />;
  }

  const all = !isPrayerKey(prayer);
  const key = all ? null : prayer;
  const name = key === null ? "every prayer" : prayerToString(prayerOfKey(key));
  // "All prayers" starts from the shared setting, or Fajr's while they differ;
  // whatever is changed there is then written to all six.
  const value: PrayerReminder =
    key === null
      ? commonReminder(settings.reminders) ?? settings.reminders.fajr
      : settings.reminders[key];

  function change(next: PrayerReminder) {
    const reminders: PrayerReminders = { ...settings!.reminders };
    if (key === null) {
      const changed = (Object.keys(next) as Array<keyof PrayerReminder>).filter(
        (field) => next[field] !== value[field]
      );
      for (const k of PRAYER_KEYS) {
        const patch: Partial<PrayerReminder> = {};
        for (const field of changed) {
          (patch as Record<string, unknown>)[field] = next[field];
        }
        reminders[k] = { ...reminders[k], ...patch };
      }
    } else {
      reminders[key] = next;
    }
    setSettings({ ...settings!, reminders });
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
            timesLine={
              todayTime === null
                ? null
                : reminderTimesLine(name, todayTime, value.offset, zone, twentyFourHour)
            }
          />
        </CenteredMaxWidthContainer>
      </IonContent>
    </IonPage>
  );
};

export default PrayerReminderPage;
