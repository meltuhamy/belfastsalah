// Renders the app, so it needs a document. The suite default is node.
// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { act } from "react";
import App from "./App";
import { AppContextProvider } from "./State";
import { AsrMethod, PrayerLocation } from "./lib/PrayerTimes";
import type { AppSettings } from "./lib/settings";
import { REMINDERS_ENDED_TITLE } from "./lib/reminderSchedule";

vi.mock("./pages/HomePage", () => ({ default: () => null }));
vi.mock("./pages/SetupPage", () => ({ default: () => null }));
vi.mock("./lib/useInterval", () => ({ useInterval: () => {} }));

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
  return {
    settings,
    sync: vi.fn(async (_options: { payload: string }) => {}),
    schedule: vi.fn(async (..._args: unknown[]) => {}),
  };
});

vi.mock("./lib/useSettings", () => ({
  useSettings: () => [harness.settings.current, async () => {}, true],
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => "android",
    isNativePlatform: () => true,
  },
  registerPlugin: (name: string) => {
    if (name === "PrayerReminders") {
      return {
        sync: (options: { payload: string }) => harness.sync(options),
      };
    }
    return {
      update: async () => {},
      openSettings: async () => {},
      isIgnoringBatteryOptimizations: async () => ({ ignoring: true }),
      openBatteryOptimizationSettings: async () => {},
    };
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: () => Promise.resolve({ remove: async () => {} }),
    exitApp: async () => {},
  },
}));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: "granted" }),
    requestPermissions: async () => ({ display: "granted" }),
    getPending: async () => ({ notifications: [] }),
    cancel: async () => {},
    schedule: (...args: unknown[]) => harness.schedule(...args),
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

function writtenPayload(): {
  reminders: Array<{ at: number; title: string; body: string }>;
} {
  const call = harness.sync.mock.calls[harness.sync.mock.calls.length - 1];
  const raw = call?.[0]?.payload as string;
  return JSON.parse(raw);
}

describe("Android reminder sync", () => {
  beforeEach(() => {
    harness.settings.current = enabledSettings();
    harness.sync.mockReset();
    harness.sync.mockImplementation(async () => {});
    harness.schedule.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(fixedNow);
  });

  afterEach(async () => {
    cleanup();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    vi.useRealTimers();
  });

  it("Should write years of reminders and leave the plugin's schedule alone", async () => {
    renderApp();

    await waitFor(() => {
      expect(harness.sync).toHaveBeenCalledTimes(1);
    });

    const payload = writtenPayload();
    expect(payload.reminders.length).toBeGreaterThan(10_000);
    expect(payload.reminders[0]).toMatchObject({
      at: Date.parse("2026-11-16T11:45:00Z"),
      title: "Duhr is at 11:50",
    });
    const prompt = payload.reminders[payload.reminders.length - 1];
    expect(prompt.title).toEqual(REMINDERS_ENDED_TITLE);
    // The old Android batch ended on a prompt around here.
    expect(payload.reminders[180].title).not.toEqual(REMINDERS_ENDED_TITLE);
    expect(harness.schedule).not.toHaveBeenCalled();
  });

  it("Should clear the stored list when reminders are turned off", async () => {
    harness.settings.current = { ...enabledSettings(), notify: false };
    renderApp();

    await waitFor(() => {
      expect(harness.sync).toHaveBeenCalledTimes(1);
    });
    expect(harness.sync).toHaveBeenLastCalledWith({ payload: "" });
    expect(harness.schedule).not.toHaveBeenCalled();
  });

  it("Should rewrite the list as soon as the lead time changes", async () => {
    const view = renderApp();
    await waitFor(() => {
      expect(harness.sync).toHaveBeenCalledTimes(1);
    });

    harness.settings.current = { ...enabledSettings(), notifyMinutes: 20 };
    view.rerender(
      <AppContextProvider>
        <App />
      </AppContextProvider>
    );

    await waitFor(() => {
      expect(harness.sync).toHaveBeenCalledTimes(2);
    });
    expect(writtenPayload().reminders[0]).toMatchObject({
      at: Date.parse("2026-11-16T11:30:00Z"),
      title: "Duhr is at 11:50",
      body: "20 minute reminder",
    });
  });
});
