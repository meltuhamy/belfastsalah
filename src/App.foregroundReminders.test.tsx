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
  return { settings, clearAndSetNotifications, state };
});

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
});
