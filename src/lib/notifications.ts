import {
  LocalNotifications,
  LocalNotificationSchema,
} from "@capacitor/local-notifications";
import { addSeconds } from "date-fns";
import { Capacitor } from "@capacitor/core";
import { ensureReminderChannels } from "./nativeReminders";
import {
  androidChannelId,
  iosSoundName,
  ReminderSound,
} from "./reminderSound";

// Well clear of the prayer reminders. Those use the low ids (up to the
// platform limit in reminderSchedule), so firing a test never disturbs one,
// and clearAndSetNotifications leaves this id out of what it cancels.
const TEST_NOTIFICATION_ID = 9999;
// The test day's notifications, one id per prayer. Like the test notification,
// they sit above the reminders' ids and are left alone by a reschedule.
const PREVIEW_NOTIFICATION_BASE = 9900;
const isDiagnostic = (id: number) => id >= PREVIEW_NOTIFICATION_BASE;
export const TEST_NOTIFICATION_DELAY_SECONDS = 5;

const updateCallbacks: Array<
  (notifications: Array<LocalNotificationSchema>) => void
> = [];

// Android 13 (API 33) made POST_NOTIFICATIONS a runtime permission, so from
// targetSdk 33 upwards scheduling silently does nothing until the user has
// granted it. iOS has always needed the same up-front grant.
//
// Only a request the user made may ask. Android pauses and resumes the app
// around its permission dialog, which is a foreground event, and reports a
// first "Don't allow" as prompt-with-rationale rather than denied - so a
// foreground refresh that asked would put the dialog straight back up.
export async function ensureNotificationPermission(mayAsk = true): Promise<boolean> {
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") {
    return true;
  }
  if (current.display === "denied" || !mayAsk) {
    return false;
  }

  const requested = await LocalNotifications.requestPermissions();
  return requested.display === "granted";
}

/**
 * Replaces every pending notification with `notifications`.
 *
 * `silent` is for a refresh the user did not ask for, such as the app coming
 * back to the foreground: it neither tells listeners (no "Notifications
 * updated" toast) nor asks for permission it does not already have.
 */
export async function clearAndSetNotifications(
  notifications: Array<LocalNotificationSchema>,
  silent = false
) {
  // Leave a pending test notification alone. It fires seconds after the
  // long-press, and the app coming back to the foreground in that window -
  // or Android resuming it as the permission dialog closes - runs this.
  const pendingReminders = (
    await LocalNotifications.getPending()
  ).notifications.filter(({ id }) => !isDiagnostic(id));

  if (pendingReminders.length > 0) {
    await LocalNotifications.cancel({ notifications: pendingReminders });
  }

  if (notifications.length > 0) {
    if (!(await ensureNotificationPermission(!silent))) {
      if (!silent) {
        updateCallbacks.forEach((cb) => cb([]));
      }
      return;
    }

    await LocalNotifications.schedule({
      // allowWhileIdle is a property of Schedule, not of the notification. It
      // used to be set one level up, where the plugin ignored it, so reminders
      // were silently downgraded whenever the device was in Doze.
      notifications: notifications.map((n) => ({
        ...n,
        schedule: { ...n.schedule, allowWhileIdle: true },
      })),
    });
  }

  // A foreground refresh uses the same list shape as the last run. Telling
  // the user "Notifications updated" every time they open the app would be
  // the refresh announcing itself.
  if (!silent) {
    updateCallbacks.forEach((cb) => cb(notifications));
  }
}

export function addUpdateNotifyListener(
  callback: (notifications: Array<LocalNotificationSchema>) => void
) {
  updateCallbacks.push(callback);
}

/**
 * Tells the settings toast that reminders were rewritten.
 *
 * The toast only looks at whether the list is empty, so a single stand-in is
 * enough. The Android list is thousands of entries and is not what the toast
 * shows.
 */
export function announceReminderChange(updated: boolean, silent: boolean) {
  if (silent) {
    return;
  }
  updateCallbacks.forEach((callback) =>
    callback(
      updated
        ? [
            {
              id: 0,
              title: "",
              body: "",
              actionTypeId: "",
              extra: null,
            },
          ]
        : []
    )
  );
}

export function removeUpdateNotifyListener(
  callback: (notifications: Array<LocalNotificationSchema>) => void
) {
  // Guarded: indexOf returns -1 for a callback that was never added, and
  // splice(-1, 1) would drop somebody else's listener instead of nothing.
  const index = updateCallbacks.indexOf(callback);
  if (index !== -1) {
    updateCallbacks.splice(index, 1);
  }
}

export type TestNotificationResult = "scheduled" | "denied";

/**
 * Schedules a single notification a few seconds out, so the reminder pipeline
 * can be checked end to end without waiting for a prayer time. Reached by
 * long-pressing the timer icon on the settings screen.
 */
export async function sendTestNotification(
  sound: ReminderSound = "default"
): Promise<TestNotificationResult> {
  if (!(await ensureNotificationPermission())) {
    return "denied";
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: TEST_NOTIFICATION_ID,
        title: "Test notification",
        body: "Reminders are working. This is not a prayer time.",
        schedule: {
          at: addSeconds(new Date(), TEST_NOTIFICATION_DELAY_SECONDS),
          allowWhileIdle: true,
        },
        // The chosen sound, so the test checks it too. Android's channels
        // are created by the native reminder sync, which runs before the
        // reminder row (and so this long-press) is ever on screen.
        sound: iosSoundName(sound),
        channelId: androidChannelId(sound),
        actionTypeId: "",
        extra: null,
      },
    ],
  });

  return "scheduled";
}

/**
 * Shows one reminder from the test day as a real notification, with that
 * prayer's sound, straight away. Only on a phone: the web has no system
 * notifications, so the test day plays the sound in the page instead.
 *
 * Android posts it on the sound's own channel, which the native side creates
 * here first, since the test day can run before any reminder has been synced.
 */
export async function showPreviewNotification(
  index: number,
  title: string,
  body: string,
  sound: ReminderSound
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  if (!(await ensureNotificationPermission())) {
    return false;
  }
  if (Capacitor.getPlatform() === "android") {
    await ensureReminderChannels();
  }
  await LocalNotifications.schedule({
    notifications: [
      {
        id: PREVIEW_NOTIFICATION_BASE + index,
        title,
        body,
        schedule: { at: new Date(Date.now() + 250), allowWhileIdle: true },
        sound: iosSoundName(sound),
        channelId: androidChannelId(sound),
        actionTypeId: "",
        extra: null,
      },
    ],
  });
  return true;
}
