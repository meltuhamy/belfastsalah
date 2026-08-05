import {
  LocalNotifications,
  LocalNotificationSchema,
} from "@capacitor/local-notifications";
import debounce from "./debounce";

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
      notifications: notifications.map((n) => ({ ...n, allowWhileIdle: true })),
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
