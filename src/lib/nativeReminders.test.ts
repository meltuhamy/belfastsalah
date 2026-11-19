import { AsrMethod, PrayerLocation } from "./PrayerTimes";
import { AppSettings, getDefaultSettings } from "./settings";

const harness = vi.hoisted(() => ({
  sync: vi.fn(async (_options: { payload: string }) => {}),
  announce: vi.fn(),
  permission: vi.fn(async (_mayAsk?: boolean) => true),
  build: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "android" },
  registerPlugin: () => ({ sync: (options: { payload: string }) => harness.sync(options) }),
}));

vi.mock("./notifications", () => ({
  announceReminderChange: (updated: boolean, silent: boolean) =>
    harness.announce(updated, silent),
  ensureNotificationPermission: (mayAsk?: boolean) =>
    harness.permission(mayAsk),
}));

vi.mock("./reminderPayload", () => ({
  REMINDER_HORIZON_DAYS: 365,
  buildReminderPayload: (...args: unknown[]) => harness.build(...args),
}));

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...getDefaultSettings(),
    location: PrayerLocation.London,
    notify: true,
    notifyMinutes: 5,
    asrMethod: AsrMethod.Shafi,
    ...overrides,
  };
}

// The module remembers its last write, so each test needs its own copy of it.
async function startSession() {
  vi.resetModules();
  return import("./nativeReminders");
}

describe("syncAndroidReminders", () => {
  beforeEach(() => {
    harness.sync.mockClear();
    harness.sync.mockImplementation(async () => {});
    harness.announce.mockClear();
    harness.permission.mockClear();
    harness.permission.mockImplementation(async () => true);
    harness.build.mockReset();
    // Same list for a given lead time, and a fresh timestamp - which is what
    // two foregrounds a second apart actually produce.
    harness.build.mockImplementation(
      async (current: AppSettings, now: Date) => ({
        version: 1,
        generatedAt: now.getTime(),
        reminders: [
          {
            at: Date.parse("2026-11-16T11:45:00Z"),
            title: `Duhr is at 11:50`,
            body: `${current.notifyMinutes} minute reminder`,
          },
        ],
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Should not write the same list twice", async () => {
    const { syncAndroidReminders } = await startSession();

    await syncAndroidReminders(settings(), new Date("2026-11-16T10:00:00Z"), true);
    await syncAndroidReminders(settings(), new Date("2026-11-16T10:00:01Z"), true);

    expect(harness.sync).toHaveBeenCalledTimes(1);
    expect(harness.build).toHaveBeenCalledTimes(2);
  });

  it("Should write again when the list changes", async () => {
    const { syncAndroidReminders } = await startSession();
    const now = new Date("2026-11-16T10:00:00Z");

    await syncAndroidReminders(settings(), now, true);
    await syncAndroidReminders(settings({ notifyMinutes: 10 }), now, true);

    expect(harness.sync).toHaveBeenCalledTimes(2);
    expect(JSON.parse(harness.sync.mock.calls[1][0].payload).reminders[0].body).toEqual(
      "10 minute reminder"
    );
  });

  it("Should clear once when reminders are off, and write again when they come back", async () => {
    const { syncAndroidReminders } = await startSession();
    const now = new Date("2026-11-16T10:00:00Z");

    await syncAndroidReminders(settings({ notify: false }), now, true);
    await syncAndroidReminders(settings({ notify: false }), now, true);
    expect(harness.sync).toHaveBeenCalledTimes(1);
    expect(harness.sync.mock.calls[0][0].payload).toEqual("");

    await syncAndroidReminders(settings(), now, true);
    expect(harness.sync).toHaveBeenCalledTimes(2);
  });

  it("Should retry a write that failed", async () => {
    const { syncAndroidReminders } = await startSession();
    const now = new Date("2026-11-16T10:00:00Z");
    harness.sync.mockRejectedValueOnce(new Error("bridge"));

    await expect(syncAndroidReminders(settings(), now, true)).rejects.toThrow(
      "bridge"
    );
    await syncAndroidReminders(settings(), now, true);

    expect(harness.sync).toHaveBeenCalledTimes(2);
  });
});
