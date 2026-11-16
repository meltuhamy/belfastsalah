import type { LocalNotificationSchema } from "@capacitor/local-notifications";
import {
  addUpdateNotifyListener,
  clearAndSetNotifications,
  removeUpdateNotifyListener,
} from "./notifications";

type Stored = { id: number };

const controls = vi.hoisted(() => {
  const pending: Stored[] = [];
  const blockers: Array<() => void> = [];
  let blockSchedule = false;
  const schedule = vi.fn(
    async ({ notifications }: { notifications: Stored[] }) => {
      if (blockSchedule) {
        await new Promise<void>((resolve) => blockers.push(resolve));
      }
      pending.push(...notifications.map((notification) => ({ ...notification })));
    }
  );
  const cancel = vi.fn(
    async ({ notifications }: { notifications: Stored[] }) => {
      const drop = new Set(notifications.map((notification) => notification.id));
      for (let i = pending.length - 1; i >= 0; i -= 1) {
        if (drop.has(pending[i].id)) {
          pending.splice(i, 1);
        }
      }
    }
  );
  return {
    pending,
    blockers,
    schedule,
    cancel,
    setBlock(value: boolean) {
      blockSchedule = value;
    },
  };
});

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    getPending: async () => ({
      notifications: controls.pending.map((notification) => ({ ...notification })),
    }),
    cancel: (pending: { notifications: Stored[] }) => controls.cancel(pending),
    schedule: (request: { notifications: Stored[] }) => controls.schedule(request),
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

async function settle(run: Promise<void>) {
  await vi.advanceTimersByTimeAsync(500);
  await run;
}

describe("clearAndSetNotifications", () => {
  beforeEach(() => {
    controls.pending.splice(0, controls.pending.length);
    controls.blockers.splice(0, controls.blockers.length);
    controls.setBlock(false);
    controls.schedule.mockClear();
    controls.cancel.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Should leave one copy of the list when the same run happens twice", async () => {
    const list = [slot(1), slot(2)];

    await settle(clearAndSetNotifications(list));
    await settle(clearAndSetNotifications(list));

    expect(controls.schedule).toHaveBeenCalledTimes(2);
    // The second run cancels the first, then writes the same ids again.
    expect(controls.cancel).toHaveBeenCalledTimes(1);
    expect(controls.pending.map((notification) => notification.id)).toEqual([
      1, 2,
    ]);
  });

  it("Should keep a later run from overlapping an earlier one and drop the earlier list", async () => {
    controls.setBlock(true);

    const first = clearAndSetNotifications([slot(1)], true);
    await vi.advanceTimersByTimeAsync(500);
    expect(controls.schedule).toHaveBeenCalledTimes(1);

    const second = clearAndSetNotifications([slot(2)], true);
    await vi.advanceTimersByTimeAsync(500);
    // Chained behind the first apply, which has not finished.
    expect(controls.schedule).toHaveBeenCalledTimes(1);

    controls.blockers.shift()?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(controls.schedule).toHaveBeenCalledTimes(2);

    controls.blockers.shift()?.();
    await Promise.all([first, second]);

    expect(controls.pending.map((notification) => notification.id)).toEqual([2]);
  });

  it("Should collapse a burst into the latest list", async () => {
    const first = clearAndSetNotifications([slot(1)]);
    const second = clearAndSetNotifications([slot(2)]);
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all([first, second]);

    expect(controls.schedule).toHaveBeenCalledTimes(1);
    expect(controls.pending.map((notification) => notification.id)).toEqual([2]);
  });

  it("Should stay quiet when asked, unless the same burst also asked to announce", async () => {
    const heard = vi.fn();
    addUpdateNotifyListener(heard);

    await settle(clearAndSetNotifications([slot(1)], true));
    expect(heard).not.toHaveBeenCalled();

    const quiet = clearAndSetNotifications([slot(1)], true);
    const loud = clearAndSetNotifications([slot(2)], false);
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all([quiet, loud]);
    expect(heard).toHaveBeenCalledTimes(1);

    removeUpdateNotifyListener(heard);
  });
});
