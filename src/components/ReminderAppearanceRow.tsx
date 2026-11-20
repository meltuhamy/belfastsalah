import React, { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { IonItem, IonLabel, IonListHeader } from "@ionic/react";
import {
  ensureReminderChannels,
  openReminderChannelSettings,
  ReminderChannelState,
} from "../lib/nativeReminders";
import { PrayerKey, PrayerReminders } from "../lib/prayerReminders";
import { reminderChannels } from "../lib/reminderPayload";
import { describeAppearance } from "../lib/reminderAppearance";

type Props = {
  prayer: PrayerKey;
  reminders: PrayerReminders;
};

// iOS's own page for the app, which has its Notifications settings. Capacitor
// hands a navigation to a scheme it does not serve to the system.
const IOS_APP_SETTINGS = "app-settings:";

/**
 * How a prayer's reminders appear - pop-up or not, and the rest - which is
 * the phone's setting rather than the app's. On Android each prayer has its
 * own channel, so this reads it back and opens its page in Android's
 * settings; on iOS there is one setting for the whole app. Nothing on the web.
 */
const ReminderAppearanceRow: React.FC<Props> = ({ prayer, reminders }) => {
  const platform = Capacitor.getPlatform();
  const [state, setState] = useState<ReminderChannelState | null>(null);
  // Only the sounds decide the channels; the rest of a reminder can change
  // without a round trip to Android.
  const soundsKey = JSON.stringify(reminderChannels({ reminders }));

  useEffect(() => {
    if (platform !== "android") {
      return;
    }
    let cancelled = false;
    const refresh = () => {
      ensureReminderChannels(reminders)
        .then((next) => {
          if (!cancelled) setState(next);
        })
        .catch((error) => console.warn("Could not read notification channels", error));
    };
    refresh();
    // Back from Android's settings, which is where this changes.
    const handle = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) refresh();
    });
    return () => {
      cancelled = true;
      void handle.then((h) => h.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, soundsKey]);

  if (platform === "web") {
    return null;
  }

  const ios = platform === "ios";
  const summary = ios
    ? "Banners and sounds are set for the whole app in iOS Settings"
    : describeAppearance(state, prayer) ?? "Set in Android settings";

  return (
    <>
      <IonListHeader>
        <IonLabel>Appearance</IonLabel>
      </IonListHeader>
      <IonItem
        button={true}
        detail={true}
        data-testid="reminder-appearance"
        onClick={() => {
          if (ios) {
            window.location.href = IOS_APP_SETTINGS;
          } else {
            void openReminderChannelSettings(prayer).catch((error) =>
              console.warn("Could not open notification settings", error)
            );
          }
        }}
      >
        <IonLabel className="ion-text-wrap">
          <h3 data-testid="reminder-appearance-summary">{summary}</h3>
          <p>
            {ios
              ? "Open iOS Settings"
              : "Pop-up, vibration and lock screen are chosen in Android settings"}
          </p>
        </IonLabel>
      </IonItem>
    </>
  );
};

export default ReminderAppearanceRow;
