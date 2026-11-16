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
    permission: { display: "granted" },
    requestPermissions: vi.fn(async () => ({ display: "granted" })),
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
    checkPermissions: async () => ({ ...controls.permission }),
    requestPermissions: () => controls.requestPermissions(),
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
    controls.requestPermissions.mockClear();
    controls.permission.display = "granted";
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

  // Android reports a first "Don't allow" this way, and its dialog resumes
  // the app as it closes. A foreground refresh that asked would ask again.
  it("Should not ask for permission on a silent refresh", async () => {
    controls.permission.display = "prompt-with-rationale";

    await clearAndSetNotifications([slot(1)], true);

    expect(controls.requestPermissions).not.toHaveBeenCalled();
    expect(controls.schedule).not.toHaveBeenCalled();
  });

  it("Should still ask when the user changed a setting", async () => {
    controls.permission.display = "prompt-with-rationale";

    await clearAndSetNotifications([slot(1)]);

    expect(controls.requestPermissions).toHaveBeenCalledTimes(1);
    expect(controls.schedule).toHaveBeenCalledTimes(1);
  });
});
