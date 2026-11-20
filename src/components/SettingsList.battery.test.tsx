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
    ignoring: boolean;
    listener: StateListener | null;
  } = {
    ignoring: true,
    listener: null,
  };
  return {
    state,
    isIgnoringBatteryOptimizations: vi.fn(async () => ({
      ignoring: state.ignoring,
    })),
    openBatteryOptimizationSettings: vi.fn(async () => {}),
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
    isIgnoringBatteryOptimizations: () =>
      harness.isIgnoringBatteryOptimizations(),
    openBatteryOptimizationSettings: () =>
      harness.openBatteryOptimizationSettings(),
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
    checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    changeExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
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
      onLocationChange={() => {}}
      onAsrMethodChange={() => {}}
      onThemeChange={() => {}}
      onTimeFormatChange={() => {}}
      onShowTimesInDeviceZoneChange={() => {}}
    />
  );
}

describe("battery optimisation warning", () => {
  beforeEach(() => {
    harness.state.ignoring = true;
    harness.state.listener = null;
    harness.isIgnoringBatteryOptimizations.mockClear();
    harness.openBatteryOptimizationSettings.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("Should show a warning when the app is battery-optimised and hide it once allowed", async () => {
    renderList();

    await waitFor(() => {
      expect(harness.isIgnoringBatteryOptimizations).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("battery-optimisation-warning")).toBeNull();

    harness.state.ignoring = false;
    await act(async () => {
      harness.state.listener?.({ isActive: true });
    });

    await waitFor(() => {
      expect(screen.getByTestId("battery-optimisation-warning")).toBeTruthy();
    });
    expect(
      screen.getByTestId("battery-optimisation-warning").textContent
    ).toContain("Battery saving may stop reminders");
    expect(
      screen.getByTestId("battery-optimisation-warning").textContent
    ).toContain("Some phones delay or stop reminders");
    expect(
      screen.getByTestId("battery-optimisation-warning").textContent
    ).toContain("Tap to open Battery optimisation");

    fireEvent.click(screen.getByTestId("battery-optimisation-warning"));
    await waitFor(() => {
      expect(harness.openBatteryOptimizationSettings).toHaveBeenCalledTimes(1);
    });
    // Opened the system list and came back without allowing it.
    expect(screen.getByTestId("battery-optimisation-warning")).toBeTruthy();

    harness.state.ignoring = true;
    await act(async () => {
      harness.state.listener?.({ isActive: true });
    });

    await waitFor(() => {
      expect(screen.queryByTestId("battery-optimisation-warning")).toBeNull();
    });
  });
});
