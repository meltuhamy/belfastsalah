import type { LocalNotificationSchema } from "@capacitor/local-notifications";
import {
  addUpdateNotifyListener,
  clearAndSetNotifications,
  removeUpdateNotifyListener,
} from "./notifications";

const controls = vi.hoisted(() => {
  const pending: { id: number }[] = [];
  return {
    pending,
    schedule: vi.fn(
      async ({ notifications }: { notifications: { id: number }[] }) => {
        pending.push(...notifications.map((notification) => ({ ...notification })));
      }
    ),
    cancel: vi.fn(async () => {
      pending.splice(0, pending.length);
    }),
  };
});

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    getPending: async () => ({
      notifications: controls.pending.map((notification) => ({ ...notification })),
    }),
    cancel: () => controls.cancel(),
    schedule: (request: { notifications: { id: number }[] }) =>
      controls.schedule(request),
    checkPermissions: async () => ({ display: "granted" }),
    requestPermissions: async () => ({ display: "granted" }),
  },
}));

function slot(id: number): LocalNotificationSchema {
  return {
    id,
    title: `Prayer ${id}`,
    body: "reminder",
    schedule: { at: new Date("2026-12-01T12:00:00Z") },
    actionTypeId: "",
    extra: null,
  };
}

describe("clearAndSetNotifications", () => {
  beforeEach(() => {
    controls.pending.splice(0, controls.pending.length);
    controls.schedule.mockClear();
    controls.cancel.mockClear();
  });

  it("Should stay quiet when asked and tell listeners otherwise", async () => {
    const heard = vi.fn();
    addUpdateNotifyListener(heard);

    await clearAndSetNotifications([slot(1)], true);
    expect(heard).not.toHaveBeenCalled();

    await clearAndSetNotifications([slot(2)]);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard.mock.calls[0][0]).toEqual([slot(2)]);

    removeUpdateNotifyListener(heard);
  });
});
