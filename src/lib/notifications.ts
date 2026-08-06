import {
  LocalNotifications,
  LocalNotificationSchema,
} from "@capacitor/local-notifications";
import { addSeconds } from "date-fns";
import debounce from "./debounce";

// Well clear of the prayer reminders, which use ids 0 to 64, so firing a test
// never disturbs a real one.
const TEST_NOTIFICATION_ID = 9999;
export const TEST_NOTIFICATION_DELAY_SECONDS = 5;

const updateCallbacks: Array<
  (notifications: Array<LocalNotificationSchema>) => void
> = [];

// Android 13 (API 33) made POST_NOTIFICATIONS a runtime permission, so from
// targetSdk 33 upwards scheduling silently does nothing until the user has
// granted it. iOS has always needed the same up-front grant.
async function ensureNotificationPermission(): Promise<boolean> {
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") {
    return true;
  }
  if (current.display === "denied") {
    return false;
  }

  const requested = await LocalNotifications.requestPermissions();
  return requested.display === "granted";
}

async function clearAndSetNotificationsImpl(
  notifications: Array<LocalNotificationSchema>
) {
  const pendingNotifications = await LocalNotifications.getPending();

  if (pendingNotifications.notifications.length > 0) {
    await LocalNotifications.cancel(pendingNotifications);
  }

  if (notifications.length > 0) {
    if (!(await ensureNotificationPermission())) {
      updateCallbacks.forEach((cb) => cb([]));
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

  updateCallbacks.forEach((cb) => cb(notifications));
}

const clearAndSetNotificationsDebounced = debounce(
  clearAndSetNotificationsImpl,
  500
);

export function clearAndSetNotifications(
  notifications: Array<LocalNotificationSchema>
) {
  return clearAndSetNotificationsDebounced(notifications);
}

export function addUpdateNotifyListener(
  callback: (notifications: Array<LocalNotificationSchema>) => void
) {
  updateCallbacks.push(callback);
}

export function removeUpdateNotifyListener(
  callback: (notifications: Array<LocalNotificationSchema>) => void
) {
  updateCallbacks.splice(updateCallbacks.indexOf(callback), 1);
}

export type TestNotificationResult = "scheduled" | "denied";

/**
 * Schedules a single notification a few seconds out, so the reminder pipeline
 * can be checked end to end without waiting for a prayer time. Reached by
 * long-pressing the timer icon on the settings screen.
 */
export async function sendTestNotification(): Promise<TestNotificationResult> {
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
        actionTypeId: "",
        extra: null,
      },
    ],
  });

  return "scheduled";
}
