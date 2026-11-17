import { gzipSync } from "node:zlib";
import { AsrMethod, PrayerLocation } from "./PrayerTimes";
import { AppSettings, getDefaultSettings } from "./settings";
import { REMINDERS_ENDED_TITLE } from "./reminderSchedule";
import {
  REMINDER_HORIZON_DAYS,
  buildReminderPayload,
} from "./reminderPayload";

function london(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...getDefaultSettings(),
    location: PrayerLocation.London,
    notify: true,
    notifyMinutes: 5,
    ...overrides,
  };
}

const MORNING = new Date("2026-11-16T10:00:00Z");

describe("buildReminderPayload", () => {
  it("Should remind the next prayer and keep the prompt at the end of the horizon", async () => {
    const payload = (await buildReminderPayload(london(), MORNING, 3))!;

    // 16 November: Duhr 11:50, reminded five minutes before.
    expect(payload.version).toEqual(1);
    expect(payload.generatedAt).toEqual(MORNING.getTime());
    expect(payload.reminders[0]).toEqual({
      at: Date.parse("2026-11-16T11:45:00Z"),
      title: "Duhr is at 11:50",
      body: "5 minute reminder",
    });
    const prompt = payload.reminders[payload.reminders.length - 1];
    const lastPrayer = payload.reminders[payload.reminders.length - 2];
    expect(prompt.title).toEqual(REMINDERS_ENDED_TITLE);
    expect(prompt.body).toEqual("Open the app to keep them coming.");
    // The prompt fires at the last prayer's own time, after its reminder.
    expect(prompt.at).toBeGreaterThan(lastPrayer.at);
    expect(payload.reminders[0].title).not.toEqual(REMINDERS_ENDED_TITLE);
  });

  it("Should move only the clock in the title when the display zone changes", async () => {
    const onTheTimetable = (await buildReminderPayload(london(), MORNING, 2))!;
    const onDevice = (await buildReminderPayload(
      london({ showTimesInDeviceZone: true }),
      MORNING,
      2,
      "Asia/Dubai"
    ))!;

    expect(onDevice.reminders[0].at).toEqual(onTheTimetable.reminders[0].at);
    expect(onTheTimetable.reminders[0].title).toEqual("Duhr is at 11:50");
    // 11:50 UTC is 15:50 in Dubai. The instant did not move.
    expect(onDevice.reminders[0].title).toEqual("Duhr is at 15:50");
  });

  it("Should fire earlier for a longer lead and skip a reminder already due", async () => {
    const longer = (await buildReminderPayload(
      london({ notifyMinutes: 20 }),
      MORNING,
      2
    ))!;
    expect(longer.reminders[0]).toMatchObject({
      at: Date.parse("2026-11-16T11:30:00Z"),
      title: "Duhr is at 11:50",
      body: "20 minute reminder",
    });

    // Three minutes before Duhr, so its five minute reminder has gone.
    const almost = (await buildReminderPayload(
      london(),
      new Date("2026-11-16T11:47:00Z"),
      2
    ))!;
    expect(almost.reminders[0]).toMatchObject({
      at: Date.parse("2026-11-16T13:43:00Z"),
      title: "Asr is at 13:48",
    });
  });

  it("Should say when the reminder is the prayer itself", async () => {
    const payload = (await buildReminderPayload(
      london({ notifyMinutes: 0 }),
      MORNING,
      1
    ))!;
    expect(payload.reminders[0].body).toEqual("Prayer time reminder");
    expect(payload.reminders[0].at).toEqual(Date.parse("2026-11-16T11:50:00Z"));
  });

  it("Should keep Fajr about a day apart across the spring clock change", async () => {
    // The UK springs forward on 2026-03-29. Instants are UTC, so the gap
    // between consecutive Fajr reminders stays near 24h.
    const payload = (await buildReminderPayload(
      london(),
      new Date("2026-03-27T10:00:00Z"),
      5
    ))!;
    const fajr = payload.reminders.filter((entry) =>
      entry.title.startsWith("Fajr")
    );
    expect(fajr.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < fajr.length; i++) {
      const hours = (fajr[i].at - fajr[i - 1].at) / 3_600_000;
      expect(hours).toBeGreaterThan(22);
      expect(hours).toBeLessThan(26);
    }
  });

  it("Should keep Fajr about a day apart across the autumn clock change", async () => {
    // The UK falls back on 2026-10-25.
    const payload = (await buildReminderPayload(
      london(),
      new Date("2026-10-23T10:00:00Z"),
      5
    ))!;
    const fajr = payload.reminders.filter((entry) =>
      entry.title.startsWith("Fajr")
    );
    expect(fajr.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < fajr.length; i++) {
      const hours = (fajr[i].at - fajr[i - 1].at) / 3_600_000;
      expect(hours).toBeGreaterThan(22);
      expect(hours).toBeLessThan(26);
    }
  });

  it("Should write about five years, prompt last, and stay a small JSON list", async () => {
    const payload = (await buildReminderPayload(london(), MORNING))!;
    const json = JSON.stringify(payload);

    expect(payload.reminders.length).toBeGreaterThan(10_000);
    expect(payload.reminders.length).toBeLessThan(12_000);
    const prompt = payload.reminders[payload.reminders.length - 1];
    expect(prompt.title).toEqual(REMINDERS_ENDED_TITLE);
    // A month in, this is still a prayer. The prompt used to sit here.
    expect(payload.reminders[180].title).not.toEqual(REMINDERS_ENDED_TITLE);
    const lastAt = prompt.at;
    const spanDays = (lastAt - MORNING.getTime()) / 86_400_000;
    expect(spanDays).toBeGreaterThan(REMINDER_HORIZON_DAYS - 2);
    expect(spanDays).toBeLessThanOrEqual(REMINDER_HORIZON_DAYS + 1);
    // Titles are stored in full, so the JSON itself is a few hundred
    // kilobytes. The phone gzips it, which is what keeps the file under 200KB.
    expect(json.length).toBeGreaterThan(200_000);
    expect(gzipSync(json).length).toBeLessThan(200_000);
  });

  it("Should keep going for a location with only one year of data", async () => {
    const payload = (await buildReminderPayload(
      london({ location: PrayerLocation.Belfast, asrMethod: AsrMethod.Shafi }),
      MORNING
    ))!;
    expect(payload.reminders.length).toBeGreaterThan(10_000);
    expect(payload.reminders[payload.reminders.length - 1].title).toEqual(
      REMINDERS_ENDED_TITLE
    );
  });

  it("Should write nothing before a location is chosen", async () => {
    expect(await buildReminderPayload(getDefaultSettings(), MORNING)).toBeNull();
  });
});
