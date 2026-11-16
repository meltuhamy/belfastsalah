import { addHours, addMinutes } from "date-fns";
import { AsrMethod, LondonPrayerTimes, Prayer } from "./PrayerTimes";
import {
  ANDROID_NOTIFICATION_LIMIT,
  IOS_NOTIFICATION_LIMIT,
  notificationLimit,
  planReminders,
  type NextPrayer,
} from "./reminderSchedule";

const start = new Date("2026-11-16T10:00:00Z");

// A prayer every four hours, so a count converts straight into a span.
function everyFourHours(from: Date): Promise<NextPrayer> {
  const step = 4 * 60 * 60 * 1000;
  const index =
    Math.floor((from.getTime() - start.getTime()) / step) + 1;
  return Promise.resolve({
    prayer: (index % 6) as Prayer,
    time: new Date(start.getTime() + index * step),
  });
}

describe("notificationLimit", () => {
  it("Should stay at the iOS pending cap of 64", () => {
    expect(notificationLimit("ios")).toEqual(IOS_NOTIFICATION_LIMIT);
    expect(notificationLimit("ios")).toEqual(64);
  });

  it("Should keep the web build on the same cap, where there is no alarm manager", () => {
    expect(notificationLimit("web")).toEqual(64);
  });

  it("Should cover thirty days of six prayers on Android, plus the prompt", () => {
    expect(notificationLimit("android")).toEqual(ANDROID_NOTIFICATION_LIMIT);
    expect(ANDROID_NOTIFICATION_LIMIT).toEqual(6 * 30 + 1);
  });
});

describe("planReminders", () => {
  it("Should fill every slot but the last with a prayer, and end on the prompt", async () => {
    const slots = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      5,
      start,
      everyFourHours
    );

    expect(slots).toHaveLength(64);
    expect(slots[0].id).toEqual(0);
    expect(slots[62].id).toEqual(62);
    // The prompt keeps id 64, clear of the reminders, as it always has.
    expect(slots[63]).toMatchObject({ id: 64, prayer: null });
    expect(slots[0].at).toEqual(addMinutes(slots[0].prayerTime!, -5));
    expect(slots[63].at).toEqual(slots[62].prayerTime);
  });

  it("Should reach thirty days ahead on the Android limit", async () => {
    const slots = await planReminders(
      ANDROID_NOTIFICATION_LIMIT,
      0,
      start,
      everyFourHours
    );

    expect(slots).toHaveLength(181);
    const prompt = slots[slots.length - 1];
    expect(prompt.prayer).toBeNull();
    expect(prompt.at).toEqual(addHours(start, 180 * 4));
  });

  it("Should skip a reminder that would already be in the past and still fill the window", async () => {
    const slots = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      60,
      start,
      everyFourHours
    );

    // The first prayer is four hours out, so an hour's notice is still ahead.
    // Move the clock to thirty minutes before it and the notice is behind us.
    const almostThere = addMinutes(slots[0].prayerTime!, -30);
    const again = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      60,
      almostThere,
      everyFourHours
    );

    expect(again).toHaveLength(64);
    expect(again[0].prayerTime!.getTime()).toBeGreaterThan(
      slots[0].prayerTime!.getTime()
    );
    expect(again[0].at.getTime()).toBeGreaterThan(almostThere.getTime());
  });
});

// Against the real timetable rather than a synthetic one. GMT dates, so the
// times are london-2026.json's own strings.
describe("planReminders on the London timetable", () => {
  const london = new LondonPrayerTimes(AsrMethod.Shafi);
  const getNext = (from: Date) => london.getNext(from);

  it("Should run from the day's next reminder to a month out on Android", async () => {
    const slots = await planReminders(
      ANDROID_NOTIFICATION_LIMIT,
      5,
      new Date("2026-11-16T10:00:00Z"),
      getNext
    );

    // 16 November: Duhr 11:50.
    expect(slots[0]).toMatchObject({
      id: 0,
      prayer: Prayer.Duhr,
      at: new Date("2026-11-16T11:45:00Z"),
    });
    // 16 December: Fajr 06:17, Shuruq 07:58.
    expect(slots[178]).toMatchObject({
      id: 178,
      prayer: Prayer.Fajr,
      at: new Date("2026-12-16T06:12:00Z"),
    });
    expect(slots[179]).toMatchObject({
      id: 179,
      prayer: Prayer.Shuruq,
      at: new Date("2026-12-16T07:53:00Z"),
    });
    expect(slots[180]).toEqual({
      id: 181,
      prayer: null,
      prayerTime: null,
      at: new Date("2026-12-16T07:58:00Z"),
    });
  });

  it("Should start at the following prayer when the next one is inside the lead time", async () => {
    // Three minutes before Duhr, so its five minute reminder has gone. iOS
    // would deliver a past one at once rather than drop it.
    const slots = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      5,
      new Date("2026-11-16T11:47:00Z"),
      getNext
    );

    // 16 November: Asr 13:48.
    expect(slots[0]).toMatchObject({
      id: 0,
      prayer: Prayer.Asr,
      at: new Date("2026-11-16T13:43:00Z"),
    });
    expect(slots).toHaveLength(64);
  });
});
