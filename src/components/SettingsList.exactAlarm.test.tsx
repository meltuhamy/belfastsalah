// Renders the settings list, so it needs a document. The suite default is node.
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import SettingsList from "./SettingsList";
import { getDefaultSettings } from "../lib/settings";
import { PrayerLocation } from "../lib/PrayerTimes";

type StateListener = (state: { isActive: boolean }) => void;

const harness = vi.hoisted(() => {
  const state: {
    exactAlarm: "granted" | "denied";
    listener: StateListener | null;
  } = {
    exactAlarm: "granted",
    listener: null,
  };
  return {
    state,
    checkExactNotificationSetting: vi.fn(async () => ({
      exact_alarm: state.exactAlarm,
    })),
    changeExactNotificationSetting: vi.fn(async () => ({
      exact_alarm: state.exactAlarm,
    })),
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => "android",
    isNativePlatform: () => true,
  },
  registerPlugin: () => ({
    update: async () => {},
    openSettings: async () => {},
    // Allowed, so the battery row stays out of this test.
    isIgnoringBatteryOptimizations: async () => ({ ignoring: true }),
    openBatteryOptimizationSettings: async () => {},
  }),
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
  },
}));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkExactNotificationSetting: () =>
      harness.checkExactNotificationSetting(),
    changeExactNotificationSetting: () =>
      harness.changeExactNotificationSetting(),
    requestPermissions: async () => ({ display: "granted" }),
    checkPermissions: async () => ({ display: "granted" }),
    getPending: async () => ({ notifications: [] }),
    cancel: async () => {},
    schedule: async () => {},
  },
}));

function renderList() {
  return render(
    <SettingsList
      settings={{
        ...getDefaultSettings(),
        location: PrayerLocation.London,
        notify: true,
        timeZoneNoticeSeen: true,
      }}
      onNotifyChange={() => {}}
      onNotifyMinutesChange={() => {}}
      onLocationChange={() => {}}
      onAsrMethodChange={() => {}}
      onThemeChange={() => {}}
      onTimeFormatChange={() => {}}
      onShowTimesInDeviceZoneChange={() => {}}
    />
  );
}

describe("exact alarm warning", () => {
  beforeEach(() => {
    harness.state.exactAlarm = "granted";
    harness.state.listener = null;
    harness.checkExactNotificationSetting.mockClear();
    harness.changeExactNotificationSetting.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("Should show a warning when exact alarms are off and hide it when they are on", async () => {
    renderList();

    await waitFor(() => {
      expect(harness.checkExactNotificationSetting).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("exact-alarm-warning")).toBeNull();

    harness.state.exactAlarm = "denied";
    await act(async () => {
      harness.state.listener?.({ isActive: true });
    });

    await waitFor(() => {
      expect(screen.getByTestId("exact-alarm-warning")).toBeTruthy();
    });
    expect(screen.getByTestId("exact-alarm-warning").textContent).toContain(
      "late or not at all"
    );
    expect(screen.getByTestId("exact-alarm-warning").textContent).toContain(
      "Tap to open Alarms & reminders"
    );

    fireEvent.click(screen.getByTestId("exact-alarm-warning"));
    await waitFor(() => {
      expect(harness.changeExactNotificationSetting).toHaveBeenCalledTimes(1);
    });
    // Opened the system page and came back without allowing it.
    expect(screen.getByTestId("exact-alarm-warning")).toBeTruthy();

    harness.state.exactAlarm = "granted";
    await act(async () => {
      harness.state.listener?.({ isActive: true });
    });

    await waitFor(() => {
      expect(screen.queryByTestId("exact-alarm-warning")).toBeNull();
    });
  });
});
