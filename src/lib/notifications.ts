import {
  LocalNotifications,
  LocalNotificationSchema,
} from "@capacitor/local-notifications";
import debounce from "./debounce";

const updateCallbacks: Array<
  (notifications: Array<LocalNotificationSchema>) => void
> = [];

async function clearAndSetNotificationsImpl(
  notifications: Array<LocalNotificationSchema>
) {
  const pendingNotifications = await LocalNotifications.getPending();
  console.log("checking notifications", pendingNotifications);

  if (pendingNotifications.notifications.length > 0) {
    console.log("calling cancell", pendingNotifications);

    await LocalNotifications.cancel(pendingNotifications);
    console.log("Cancelled");
  }

  if (notifications.length > 0) {
    console.log("caslling schecule", notifications);
    await LocalNotifications.schedule({
      notifications: notifications.map((n) => ({ ...n, allowWhileIdle: true })),
    });
  }

  console.log("claling callbacks", updateCallbacks);

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
