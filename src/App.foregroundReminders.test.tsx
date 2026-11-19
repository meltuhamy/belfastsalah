// Renders the app, so it needs a document. The suite default is node.
// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { act } from "react";
import App from "./App";
import { AppContextProvider } from "./State";
import { AsrMethod, PrayerLocation } from "./lib/PrayerTimes";
import type { AppSettings } from "./lib/settings";

// The home and setup screens are not what this is about, and Ionic's shadow
// DOM makes them a poor thing to render just to reach App's effect.
vi.mock("./pages/HomePage", () => ({ default: () => null }));
vi.mock("./pages/SetupPage", () => ({ default: () => null }));
vi.mock("./lib/useInterval", () => ({ useInterval: () => {} }));

type StateListener = (state: { isActive: boolean }) => void;

const harness = vi.hoisted(() => {
  const settings: { current: AppSettings } = {
    current: {
      notify: true,
      notifyMinutes: 5,
      asrMethod: "shafi" as AppSettings["asrMethod"],
      theme: "system",
      timeFormat: "24",
      location: "london" as AppSettings["location"],
      showTimesInDeviceZone: false,
      timeZoneNoticeSeen: true,
    },
  };
  const clearAndSetNotifications = vi.fn(
    (notifications: unknown[], silent?: boolean): Promise<void> => {
      void notifications;
      void silent;
      return Promise.resolve();
    }
  );
  const state: { listener: StateListener | null } = { listener: null };
  // The phone's 12/24-hour switch, as the native plugin would report it.
  const device = {
    uses24Hour: true,
    listeners: new Set<(uses24Hour: boolean) => void>(),
  };
  return { settings, clearAndSetNotifications, state, device };
});

vi.mock("./lib/deviceTimeFormat", () => ({
  getDeviceUses24Hour: () => harness.device.uses24Hour,
  startDeviceTimeFormatWatch: async () => {},
  subscribeDeviceUses24Hour: (listener: (uses24Hour: boolean) => void) => {
    harness.device.listeners.add(listener);
    return () => {
      harness.device.listeners.delete(listener);
    };
  },
}));

vi.mock("./lib/useSettings", () => ({
  useSettings: () => [harness.settings.current, async () => {}, true],
}));

vi.mock("./lib/notifications", () => ({
  clearAndSetNotifications: (notifications: unknown[], silent?: boolean) =>
    harness.clearAndSetNotifications(notifications, silent),
  addUpdateNotifyListener: () => {},
  removeUpdateNotifyListener: () => {},
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: (event: string, listener: StateListener) => {
      if (event === "appStateChange") {
        harness.state.listener = listener;
      }
      return Promise.resolve({
        remove: async () => {
          if (harness.state.listener === listener) {
            harness.state.listener = null;
          }
        },
      });
    },
    exitApp: async () => {},
  },
}));

const fixedNow = new Date("2026-11-16T10:00:00Z");

function enabledSettings(): AppSettings {
  return {
    notify: true,
    notifyMinutes: 5,
    asrMethod: AsrMethod.Shafi,
    theme: "system",
    timeFormat: "24",
    location: PrayerLocation.London,
    showTimesInDeviceZone: false,
    timeZoneNoticeSeen: true,
  };
}

function renderApp() {
  return render(
    <AppContextProvider>
      <App />
    </AppContextProvider>
  );
}

describe("reminder scheduling when the app returns to the foreground", () => {
  beforeEach(() => {
    harness.settings.current = enabledSettings();
    harness.state.listener = null;
    harness.device.uses24Hour = true;
    harness.clearAndSetNotifications.mockReset();
    harness.clearAndSetNotifications.mockImplementation(() => Promise.resolve());
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(fixedNow);
  });

  afterEach(async () => {
    cleanup();
    harness.clearAndSetNotifications.mockImplementation(() => Promise.resolve());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    vi.useRealTimers();
  });

  it("Should schedule the same window again when the app becomes active", async () => {
    renderApp();

    await waitFor(() => {
      expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(1);
    });

    const first = harness.clearAndSetNotifications.mock.calls[0];
    expect(first[1]).toBe(false);
    expect(first[0]).toHaveLength(64);

    await act(async () => {
      harness.state.listener?.({ isActive: true });
    });

    await waitFor(() => {
      expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(2);
    });

    const second = harness.clearAndSetNotifications.mock.calls[1];
    // A second run replaces the window. With the clock held still it asks
    // for the same list, so running twice leaves one end state.
    expect(second[0]).toEqual(first[0]);
    // Foreground refreshes stay quiet: the toast is for a settings change.
    expect(second[1]).toBe(true);
  });

  it("Should end the window by asking for the app to be opened", async () => {
    renderApp();

    await waitFor(() => {
      expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(1);
    });

    const scheduled = harness.clearAndSetNotifications.mock.calls[0][0] as Array<{
      title: string;
      body: string;
      id: number;
      schedule: { at: Date };
    }>;
    expect(scheduled).toHaveLength(64);
    expect(scheduled[63]).toEqual({
      title: "Prayer reminders stop here",
      body: "Open the app to keep them coming.",
      id: 64,
      schedule: { at: new Date("2026-11-26T16:02:00Z") },
      actionTypeId: "",
      extra: null,
    });
  });

  it("Should still schedule one reminder per prayer at the longest lead", async () => {
    harness.settings.current = { ...enabledSettings(), notifyMinutes: 20 };
    renderApp();

    await waitFor(() => {
      expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(1);
    });

    const scheduled = harness.clearAndSetNotifications.mock.calls[0][0] as Array<{
      body: string;
      schedule: { at: Date };
    }>;
    expect(scheduled).toHaveLength(64);
    expect(scheduled.slice(0, 63).map((item) => item.body)).toEqual(
      Array(63).fill("20 minute reminder")
    );
    expect(scheduled[0].schedule.at).toEqual(new Date("2026-11-16T11:30:00Z"));
    expect(scheduled[63].body).toEqual("Open the app to keep them coming.");
    expect(scheduled[63].schedule.at).toEqual(new Date("2026-11-26T16:02:00Z"));
  });

  it("Should keep AM and PM in a 12-hour reminder's title", async () => {
    // Only notifications carry the half of the day; everything on screen
    // leaves it off. Android's titles come from reminderPayload.ts.
    harness.settings.current = { ...enabledSettings(), timeFormat: "12" };
    renderApp();

    await waitFor(() => {
      expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(1);
    });

    const scheduled = harness.clearAndSetNotifications.mock.calls[0][0] as Array<{
      title: string;
    }>;
    expect(scheduled[0].title).toMatch(/^Duhr is at 11:50\sAM$/);
    expect(scheduled[1].title).toMatch(/^Asr is at 1:48\sPM$/);
  });

  it("Should follow the phone's switch on System, quietly", async () => {
    harness.settings.current = { ...enabledSettings(), timeFormat: "system" };
    renderApp();

    await waitFor(() => {
      expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(1);
    });
    const first = harness.clearAndSetNotifications.mock.calls[0][0] as Array<{
      title: string;
    }>;
    expect(first[1].title).toEqual("Asr is at 13:48");

    // Turned to 12-hour in the system settings while the app was open.
    await act(async () => {
      harness.device.uses24Hour = false;
      harness.device.listeners.forEach((listener) => listener(false));
    });

    await waitFor(() => {
      expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(2);
    });
    const [second, silent] = harness.clearAndSetNotifications.mock.calls[1] as [
      Array<{ title: string }>,
      boolean,
    ];
    expect(second[1].title).toMatch(/^Asr is at 1:48\sPM$/);
    // Not a change made in the app, so no toast and no permission prompt.
    expect(silent).toBe(true);
  });

  it("Should clear pending reminders on foreground when they are switched off", async () => {
    harness.settings.current = { ...enabledSettings(), notify: false };
    renderApp();

    await waitFor(() => {
      expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(1);
    });
    expect(harness.clearAndSetNotifications).toHaveBeenLastCalledWith([], false);

    await act(async () => {
      harness.state.listener?.({ isActive: true });
    });

    await waitFor(() => {
      expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(2);
    });
    expect(harness.clearAndSetNotifications).toHaveBeenLastCalledWith([], true);
  });

  it("Should ignore a transition to the background", async () => {
    renderApp();

    await waitFor(() => {
      expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      harness.state.listener?.({ isActive: false });
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(1);
  });

  it("Should not start a second run beside one already in flight", async () => {
    let active = 0;
    let maxActive = 0;
    const gates: Array<() => void> = [];
    harness.clearAndSetNotifications.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          gates.push(() => {
            active -= 1;
            resolve();
          });
        })
    );

    renderApp();

    await waitFor(() => {
      expect(gates).toHaveLength(1);
    });

    await act(async () => {
      harness.state.listener?.({ isActive: true });
      harness.state.listener?.({ isActive: true });
    });

    // Both foreground events landed while the mount run was still going.
    expect(gates).toHaveLength(1);
    expect(maxActive).toBe(1);

    await act(async () => {
      gates.shift()?.();
    });

    await waitFor(() => {
      expect(gates).toHaveLength(1);
    });

    // The two events collapsed into one follow-up, still not overlapping.
    expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);

    await act(async () => {
      harness.state.listener?.({ isActive: true });
      harness.state.listener?.({ isActive: true });
    });
    expect(gates).toHaveLength(1);

    await act(async () => {
      gates.shift()?.();
    });

    await waitFor(() => {
      expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(3);
    });
    expect(maxActive).toBe(1);

    await act(async () => {
      gates.shift()?.();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(3);
    expect(active).toBe(0);
  });

  it("Should keep a queued settings change loud when a foreground event follows it", async () => {
    const gates: Array<() => void> = [];
    harness.clearAndSetNotifications.mockImplementation(
      () => new Promise<void>((resolve) => gates.push(resolve))
    );

    const view = renderApp();
    await waitFor(() => {
      expect(gates).toHaveLength(1);
    });

    // The user moves the reminder to ten minutes, then the app is
    // foregrounded, both while the mount run is still going.
    harness.settings.current = { ...enabledSettings(), notifyMinutes: 10 };
    view.rerender(
      <AppContextProvider>
        <App />
      </AppContextProvider>
    );
    await act(async () => {
      harness.state.listener?.({ isActive: true });
    });

    await act(async () => {
      gates.shift()?.();
    });
    await waitFor(() => {
      expect(harness.clearAndSetNotifications).toHaveBeenCalledTimes(2);
    });

    const [notifications, silent] =
      harness.clearAndSetNotifications.mock.calls[1];
    expect(silent).toBe(false);
    expect((notifications as Array<{ body: string }>)[0].body).toEqual(
      "10 minute reminder"
    );

    await act(async () => {
      gates.shift()?.();
    });
  });
});
