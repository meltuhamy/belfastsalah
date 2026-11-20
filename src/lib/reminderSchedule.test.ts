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

// Every prayer reminded the same number of minutes before it.
const before = (minutes: number) => () => ({ offset: -minutes });

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
      start,
      everyFourHours,
      before(5)
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
      start,
      everyFourHours,
      before(0)
    );

    expect(slots).toHaveLength(181);
    const prompt = slots[slots.length - 1];
    expect(prompt.prayer).toBeNull();
    expect(prompt.at).toEqual(addHours(start, 180 * 4));
  });

  it("Should skip a reminder that would already be in the past and still fill the window", async () => {
    const slots = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      start,
      everyFourHours,
      before(60)
    );

    // The first prayer is four hours out, so an hour's notice is still ahead.
    // Move the clock to thirty minutes before it and the notice is behind us.
    const almostThere = addMinutes(slots[0].prayerTime!, -30);
    const again = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      almostThere,
      everyFourHours,
      before(60)
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
      new Date("2026-11-16T10:00:00Z"),
      getNext,
      before(5)
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
      offset: 0,
    });
  });

  it("Should cover the same prayers at the default lead and at the longest one", async () => {
    const now = new Date("2026-11-16T10:00:00Z");
    const standard = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      now,
      getNext,
      before(5)
    );
    const longest = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      now,
      getNext,
      before(20)
    );

    // One reminder per prayer. Twenty minutes is not a second notification,
    // so the 64 still reach the same Maghrib ten days on.
    expect(standard).toHaveLength(64);
    expect(longest).toHaveLength(64);
    expect(standard.filter((slot) => slot.prayer !== null)).toHaveLength(63);
    expect(longest.map((slot) => slot.prayerTime)).toEqual(
      standard.map((slot) => slot.prayerTime)
    );

    // 16 November: Duhr 11:50. The longer lead only fires earlier.
    expect(standard[0]).toMatchObject({
      prayer: Prayer.Duhr,
      at: new Date("2026-11-16T11:45:00Z"),
    });
    expect(longest[0]).toMatchObject({
      prayer: Prayer.Duhr,
      at: new Date("2026-11-16T11:30:00Z"),
    });
    // 26 November: Maghrib 16:02. Eleven London dates, a little over ten days.
    expect(standard[62]).toMatchObject({
      prayer: Prayer.Maghrib,
      at: new Date("2026-11-26T15:57:00Z"),
      prayerTime: new Date("2026-11-26T16:02:00Z"),
    });
    expect(longest[62]).toMatchObject({
      prayer: Prayer.Maghrib,
      at: new Date("2026-11-26T15:42:00Z"),
      prayerTime: new Date("2026-11-26T16:02:00Z"),
    });
    expect(standard[63]).toEqual({
      id: 64,
      prayer: null,
      prayerTime: null,
      at: new Date("2026-11-26T16:02:00Z"),
      offset: 0,
    });
    expect(longest[63].at).toEqual(standard[63].at);
  });

  it("Should start a new window once the old one has run out", async () => {
    const first = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      new Date("2026-11-16T10:00:00Z"),
      getNext,
      before(5)
    );
    // The moment the last slot fires. Nothing in the old batch is still ahead.
    const refreshed = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      first[63].at,
      getNext,
      before(5)
    );

    expect(refreshed).toHaveLength(64);
    expect(refreshed[0].at.getTime()).toBeGreaterThan(first[63].at.getTime());
    expect(refreshed[63].prayer).toBeNull();
    expect(refreshed[63].at.getTime()).toBeGreaterThan(first[63].at.getTime());
    // 26 November, Maghrib 16:02 has passed. Next is Isha 17:38, reminded at 17:33.
    expect(refreshed[0]).toMatchObject({
      prayer: Prayer.Isha,
      at: new Date("2026-11-26T17:33:00Z"),
    });
    // 7 December: Shuruq 07:49. Another ten days on from the old window.
    expect(refreshed[62]).toMatchObject({
      prayer: Prayer.Shuruq,
      prayerTime: new Date("2026-12-07T07:49:00Z"),
    });
  });

  it("Should start at the following prayer when the next one is inside the lead time", async () => {
    // Three minutes before Duhr, so its five minute reminder has gone. iOS
    // would deliver a past one at once rather than drop it.
    const slots = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      new Date("2026-11-16T11:47:00Z"),
      getNext,
      before(5)
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

describe("planReminders with each prayer's own reminder", () => {
  const london = new LondonPrayerTimes(AsrMethod.Shafi);
  const getNext = (from: Date) => london.getNext(from);

  it("Should remind after a prayer that has just passed", async () => {
    // 16 November: Duhr 11:50. Ten minutes after it, with Duhr set to +20.
    const slots = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      new Date("2026-11-16T12:00:00Z"),
      getNext,
      (prayer) => ({ offset: prayer === Prayer.Duhr ? 20 : -5 })
    );

    expect(slots[0]).toMatchObject({
      prayer: Prayer.Duhr,
      offset: 20,
      at: new Date("2026-11-16T12:10:00Z"),
    });
  });

  it("Should leave out a prayer that is turned off", async () => {
    const slots = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      new Date("2026-11-16T10:00:00Z"),
      getNext,
      (prayer) => (prayer === Prayer.Shuruq ? null : { offset: -5 })
    );

    expect(slots.some((slot) => slot.prayer === Prayer.Shuruq)).toBe(false);
    expect(slots).toHaveLength(64);
  });

  it("Should schedule nothing when every prayer is off", async () => {
    const slots = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      new Date("2026-11-16T10:00:00Z"),
      getNext,
      () => null
    );

    expect(slots).toEqual([]);
  });

  it("Should keep reminders in time order when offsets cross", async () => {
    const slots = await planReminders(
      IOS_NOTIFICATION_LIMIT,
      new Date("2026-11-16T10:00:00Z"),
      getNext,
      (prayer) => ({ offset: prayer === Prayer.Fajr ? 30 : -30 })
    );
    const times = slots.slice(0, -1).map((slot) => slot.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});
