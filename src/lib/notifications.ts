import {
  LocalNotifications,
  LocalNotificationSchema,
} from "@capacitor/local-notifications";
import { addSeconds } from "date-fns";

// Well clear of the prayer reminders. Those use the low ids (up to the
// platform limit in reminderSchedule), so firing a test never disturbs one.
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
  notifications: Array<LocalNotificationSchema>,
  silent: boolean
) {
  const pendingNotifications = await LocalNotifications.getPending();

  if (pendingNotifications.notifications.length > 0) {
    await LocalNotifications.cancel(pendingNotifications);
  }

  if (notifications.length > 0) {
    if (!(await ensureNotificationPermission())) {
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

// Same wait the old debounce used, so a burst of settings changes still
// becomes one write. Applies are chained: each run cancels whatever is
// pending and writes its own list, and two of those overlapping can each
// read the old set and end up with both lists pending.
const SCHEDULE_WAIT_MS = 500;

let scheduleTimer: ReturnType<typeof setTimeout> | null = null;
let scheduleQueued: Array<LocalNotificationSchema> = [];
let scheduleQueuedSilent = true;
let scheduleResolvers: Array<() => void> = [];
let scheduleChain: Promise<void> = Promise.resolve();

export function clearAndSetNotifications(
  notifications: Array<LocalNotificationSchema>,
  silent = false
): Promise<void> {
  scheduleQueued = notifications;
  scheduleQueuedSilent =
    scheduleResolvers.length === 0 ? silent : scheduleQueuedSilent && silent;

  return new Promise((resolve) => {
    scheduleResolvers.push(resolve);
    if (scheduleTimer != null) {
      clearTimeout(scheduleTimer);
    }
    scheduleTimer = setTimeout(() => {
      scheduleTimer = null;
      const batch = scheduleQueued;
      const silentRun = scheduleQueuedSilent;
      const resolvers = scheduleResolvers;
      scheduleQueued = [];
      scheduleQueuedSilent = true;
      scheduleResolvers = [];

      const run = scheduleChain
        .catch(() => undefined)
        .then(() => clearAndSetNotificationsImpl(batch, silentRun));
      scheduleChain = run.then(
        () => undefined,
        () => undefined
      );
      void run.then(
        () => resolvers.forEach((done) => done()),
        (error) => {
          console.warn("Could not schedule prayer reminders", error);
          resolvers.forEach((done) => done());
        }
      );
    }, SCHEDULE_WAIT_MS);
  });
}

export function addUpdateNotifyListener(
  callback: (notifications: Array<LocalNotificationSchema>) => void
) {
  updateCallbacks.push(callback);
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
