import { LocalNotification } from "@capacitor/core";
import { Plugins } from "@capacitor/core";
import debounce from "./debounce";

const { LocalNotifications } = Plugins;
const updateCallbacks: Array<
  (notifications: Array<LocalNotification>) => void
> = [];

async function clearAndSetNotificationsImpl(
  notifications: Array<LocalNotification>
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
      notifications: notifications,
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
  notifications: Array<LocalNotification>
) {
  return clearAndSetNotificationsDebounced(notifications);
}

export function addUpdateNotifyListener(
  callback: (notifications: Array<LocalNotification>) => void
) {
  updateCallbacks.push(callback);
}

export function removeUpdateNotifyListener(
  callback: (notifications: Array<LocalNotification>) => void
) {
  updateCallbacks.splice(updateCallbacks.indexOf(callback), 1);
}
