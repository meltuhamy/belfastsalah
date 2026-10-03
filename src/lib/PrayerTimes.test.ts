import {
  BelfastPrayerTimes,
  LondonPrayerTimes,
  PrayerTime,
  AsrMethod,
  Prayer,
  PrayerLocation
} from "./PrayerTimes";
import { getAvailableYears } from "./PrayerTimeData";

const londonShafi = new LondonPrayerTimes(AsrMethod.Shafi);
const londonHanafi = new LondonPrayerTimes(AsrMethod.Hanafi);

// Prayer times are stored and compared in UTC so that these tests give the
// same result regardless of the machine's timezone.
function utc(
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0
): Date {
  return new Date(Date.UTC(year, month - 1, day, hours, minutes));
}

interface PrayerMatchers<R = unknown> {
  toBePrayer(prayer: Prayer, time: Date): R;
}

declare module "vitest" {
  interface Matchers<T = any> extends PrayerMatchers<T> {}
}

expect.extend({
  toBePrayer(received: PrayerTime, prayer: Prayer, time: Date) {
    const prayerNames = ["Fajr", "Shuruq", "Duhr", "Asr", "Maghrib", "Isha"];
    const matchingPrayer = this.equals(received.prayer, prayer);
    const matchingTime = this.equals(received.time, time);
    let message = "";
    if (matchingPrayer) {
      message = message + "Has matching prayer " + prayerNames[prayer];
    } else {
      message =
        message +
        "Prayers are not matching. Expected " +
        prayerNames[prayer] +
        ". Received " +
        prayerNames[received.prayer];
    }

    message = message + ". \n";

    if (matchingTime) {
      message = message + "Has matching time " + time.toISOString();
    } else {
      message =
        message +
        "Times not matching. Expected " +
        time.toISOString() +
        ". Received " +
        received.time.toISOString();
    }

    return { pass: matchingPrayer && matchingTime, message: () => message };
  }
});

describe("Prayer data year selection", () => {
  it("Should offer every year we ship data for", () => {
    expect(getAvailableYears(PrayerLocation.London)).toEqual([
      2022, 2023, 2024, 2025, 2026
    ]);
    expect(getAvailableYears(PrayerLocation.Belfast)).toEqual([2019]);
  });

  it("Should use the data for the requested year, not an older one", async () => {
    // Regression test: the year list used to be hardcoded and stopped at 2024,
    // so 2025 and 2026 were quietly served 2024's timetable. 301 of 366 days
    // differ between 2024 and 2026, so this is a real accuracy bug.
    // 2026-03-04 -> 04:58 in the 2024 table, 05:01 in the 2026 table.
    const marchFourth2026 = await londonShafi.getDay(utc(2026, 3, 4));

    expect(marchFourth2026[Prayer.Fajr]).toBePrayer(
      Prayer.Fajr,
      utc(2026, 3, 4, 5, 1)
    );
  });

  it("Should clamp to the earliest year we have when asked for an older one", async () => {
    // 2019 predates our London data, so it falls back to the earliest (2022).
    const dayTimes = await londonShafi.getDay(utc(2019, 7, 8));
    expect(dayTimes[Prayer.Fajr].prayer).toEqual(Prayer.Fajr);
  });

  it("Should clamp to the latest year we have when asked for a future one", async () => {
    // 2099 is beyond our data, so it falls back to the latest (2026).
    const dayTimes = await londonShafi.getDay(utc(2099, 3, 4));
    expect(dayTimes[Prayer.Fajr].time.getUTCHours()).toEqual(5);
    expect(dayTimes[Prayer.Fajr].time.getUTCMinutes()).toEqual(1);
  });
});

describe("London Prayer Times", () => {
  // 2024-07-08: ["7","8","01:58","03:51","12:11","16:26","17:40","20:20","21:30"]
  it("Should allow getting a prayer day with shafi asr", async () => {
    const julyEighthTimes = await londonShafi.getDay(utc(2024, 7, 8, 6));

    expect(julyEighthTimes[Prayer.Fajr]).toBePrayer(
      Prayer.Fajr,
      utc(2024, 7, 8, 1, 58)
    );

    expect(julyEighthTimes[Prayer.Shuruq]).toBePrayer(
      Prayer.Shuruq,
      utc(2024, 7, 8, 3, 51)
    );

    expect(julyEighthTimes[Prayer.Duhr]).toBePrayer(
      Prayer.Duhr,
      utc(2024, 7, 8, 12, 11)
    );

    expect(julyEighthTimes[Prayer.Asr]).toBePrayer(
      Prayer.Asr,
      utc(2024, 7, 8, 16, 26)
    );

    expect(julyEighthTimes[Prayer.Maghrib]).toBePrayer(
      Prayer.Maghrib,
      utc(2024, 7, 8, 20, 20)
    );

    expect(julyEighthTimes[Prayer.Isha]).toBePrayer(
      Prayer.Isha,
      utc(2024, 7, 8, 21, 30)
    );
  });

  it("Should allow getting a prayer day with hanafi asr", async () => {
    const julyEighthTimes = await londonHanafi.getDay(utc(2024, 7, 8, 6));

    expect(julyEighthTimes[Prayer.Fajr]).toBePrayer(
      Prayer.Fajr,
      utc(2024, 7, 8, 1, 58)
    );

    expect(julyEighthTimes[Prayer.Shuruq]).toBePrayer(
      Prayer.Shuruq,
      utc(2024, 7, 8, 3, 51)
    );

    expect(julyEighthTimes[Prayer.Duhr]).toBePrayer(
      Prayer.Duhr,
      utc(2024, 7, 8, 12, 11)
    );

    // The only difference from shafi: asr uses the second asr column.
    expect(julyEighthTimes[Prayer.Asr]).toBePrayer(
      Prayer.Asr,
      utc(2024, 7, 8, 17, 40)
    );

    expect(julyEighthTimes[Prayer.Maghrib]).toBePrayer(
      Prayer.Maghrib,
      utc(2024, 7, 8, 20, 20)
    );

    expect(julyEighthTimes[Prayer.Isha]).toBePrayer(
      Prayer.Isha,
      utc(2024, 7, 8, 21, 30)
    );
  });

  it("Should allow getting next/prev prayers by Date object", async () => {
    const nextPrayerAfterMidnight = await londonShafi.getNext(utc(2024, 7, 8));

    expect(nextPrayerAfterMidnight).toBePrayer(
      Prayer.Fajr,
      utc(2024, 7, 8, 1, 58)
    );

    // a couple of minutes later, prev prayer should be fajr
    const prayerBeforeTwoAM = await londonShafi.getPrev(utc(2024, 7, 8, 2));

    expect(prayerBeforeTwoAM).toBePrayer(Prayer.Fajr, utc(2024, 7, 8, 1, 58));
  });

  it("Should allow getting next/prev prayers by PrayerTime object", async () => {
    const julyEighthTimes = await londonShafi.getDay(utc(2024, 7, 8, 6));

    const afterFajr = await londonShafi.getNext(julyEighthTimes[Prayer.Fajr]);

    expect(afterFajr).toBePrayer(Prayer.Shuruq, utc(2024, 7, 8, 3, 51));

    const beforeShuruq = await londonShafi.getPrev(afterFajr);
    expect(beforeShuruq).toEqual(julyEighthTimes[Prayer.Fajr]);
  });

  it("Should allow getting next/prev prayers for a day", async () => {
    const dayTimes = await londonShafi.getDay(utc(2024, 7, 8));
    const nextPrayerAfterMidnight = await londonShafi.getNext(utc(2024, 7, 8));

    let currentPrayer = nextPrayerAfterMidnight;
    let prevPrayer;
    expect(currentPrayer).toEqual(dayTimes[Prayer.Fajr]);

    currentPrayer = await londonShafi.getNext(currentPrayer);
    prevPrayer = await londonShafi.getPrev(currentPrayer);

    expect(prevPrayer).toEqual(dayTimes[Prayer.Fajr]);
    expect(currentPrayer).toEqual(dayTimes[Prayer.Shuruq]);

    currentPrayer = await londonShafi.getNext(currentPrayer);
    prevPrayer = await londonShafi.getPrev(currentPrayer);

    expect(prevPrayer).toEqual(dayTimes[Prayer.Shuruq]);
    expect(currentPrayer).toEqual(dayTimes[Prayer.Duhr]);

    currentPrayer = await londonShafi.getNext(currentPrayer);
    prevPrayer = await londonShafi.getPrev(currentPrayer);

    expect(prevPrayer).toEqual(dayTimes[Prayer.Duhr]);
    expect(currentPrayer).toEqual(dayTimes[Prayer.Asr]);

    currentPrayer = await londonShafi.getNext(currentPrayer);
    prevPrayer = await londonShafi.getPrev(currentPrayer);

    expect(prevPrayer).toEqual(dayTimes[Prayer.Asr]);
    expect(currentPrayer).toEqual(dayTimes[Prayer.Maghrib]);

    currentPrayer = await londonShafi.getNext(currentPrayer);
    prevPrayer = await londonShafi.getPrev(currentPrayer);

    expect(prevPrayer).toEqual(dayTimes[Prayer.Maghrib]);
    expect(currentPrayer).toEqual(dayTimes[Prayer.Isha]);
  });

  it("Should allow getting next/prev prayers between days", async () => {
    const day1Times = await londonShafi.getDay(utc(2024, 7, 8));
    const day2Times = await londonShafi.getDay(utc(2024, 7, 9));

    const prayerAfterDay1Isha = await londonShafi.getNext(
      day1Times[Prayer.Isha]
    );

    expect(prayerAfterDay1Isha).toEqual(day2Times[Prayer.Fajr]);

    const prayerBeforeDay1Isha = await londonShafi.getPrev(prayerAfterDay1Isha);
    expect(prayerBeforeDay1Isha).toEqual(day1Times[Prayer.Isha]);
  });

  it("Should allow getting next prayers between months", async () => {
    // 2024-07-31 isha 20:56, 2024-08-01 fajr 02:40
    const lastDayOfJulyTimes = await londonShafi.getDay(utc(2024, 7, 31));
    const firstDayOfAugustTimes = await londonShafi.getDay(utc(2024, 8, 1));

    const prayerAfterIshaOnLastDayOfJuly = await londonShafi.getNext(
      lastDayOfJulyTimes[Prayer.Isha].time
    );

    expect(prayerAfterIshaOnLastDayOfJuly).toEqual(
      firstDayOfAugustTimes[Prayer.Fajr]
    );

    expect(firstDayOfAugustTimes[Prayer.Fajr]).toBePrayer(
      Prayer.Fajr,
      utc(2024, 8, 1, 2, 40)
    );

    const prayerBefore = await londonShafi.getPrev(
      prayerAfterIshaOnLastDayOfJuly
    );

    expect(prayerBefore).toEqual(lastDayOfJulyTimes[Prayer.Isha]);
  });

  it("Should allow getting next/prev prayers in feb during a non-leap year", async () => {
    // 2023-02-28: ["2","28","05:09","06:46","12:18","15:03","15:47","17:42","19:09"]
    // 2023-03-01: ["3","1","05:07","06:44","12:18","15:04","15:48","17:43","19:09"]
    const lastDayFebTimes = await londonShafi.getDay(utc(2023, 2, 28));

    expect(lastDayFebTimes[Prayer.Isha]).toBePrayer(
      Prayer.Isha,
      utc(2023, 2, 28, 19, 9)
    );

    const firstDayMarchTimes = await londonShafi.getDay(utc(2023, 3, 1));

    expect(firstDayMarchTimes[Prayer.Fajr]).toBePrayer(
      Prayer.Fajr,
      utc(2023, 3, 1, 5, 7)
    );

    const prayerAfterIshaOnLastDayOfFeb = await londonShafi.getNext(
      lastDayFebTimes[Prayer.Isha].time
    );

    expect(prayerAfterIshaOnLastDayOfFeb).toEqual(
      firstDayMarchTimes[Prayer.Fajr]
    );

    const prevPrayer = await londonShafi.getPrev(
      firstDayMarchTimes[Prayer.Fajr]
    );
    expect(prevPrayer).toEqual(lastDayFebTimes[Prayer.Isha]);
  });

  it("Should allow getting next/prev prayers in feb during a leap year", async () => {
    // 2024 is a leap year.
    // 2024-02-28: ["2","28","05:09","06:46","12:18","15:03","15:46","17:41","19:08"]
    // 2024-02-29: ["2","29","05:07","06:44","12:18","15:04","15:48","17:43","19:09"]
    // 2024-03-01: ["3","1","05:05","06:42","12:18","15:05","15:49","17:45","19:11"]
    const secondLastDayFebTimes = await londonShafi.getDay(utc(2024, 2, 28));
    const lastDayFebTimes = await londonShafi.getDay(utc(2024, 2, 29));

    expect(lastDayFebTimes[Prayer.Isha]).toBePrayer(
      Prayer.Isha,
      utc(2024, 2, 29, 19, 9)
    );

    const firstDayMarchTimes = await londonShafi.getDay(utc(2024, 3, 1));

    const nextPrayerAfterSecondLastDayFebIsha = await londonShafi.getNext(
      secondLastDayFebTimes[Prayer.Isha].time
    );

    expect(nextPrayerAfterSecondLastDayFebIsha).toEqual(
      lastDayFebTimes[Prayer.Fajr]
    );

    const prayerAfterIshaLastDayFeb = await londonShafi.getNext(
      lastDayFebTimes[Prayer.Isha].time
    );

    expect(prayerAfterIshaLastDayFeb).toEqual(firstDayMarchTimes[Prayer.Fajr]);

    const beforeFirstMarchFajr = await londonShafi.getPrev(
      firstDayMarchTimes[Prayer.Fajr]
    );

    expect(beforeFirstMarchFajr).toEqual(lastDayFebTimes[Prayer.Isha]);

    const beforeLastFebFajr = await londonShafi.getPrev(
      lastDayFebTimes[Prayer.Fajr]
    );
    expect(beforeLastFebFajr).toEqual(secondLastDayFebTimes[Prayer.Isha]);
  });

  it("Should get next/prev prayers between years", async () => {
    // 2023-12-31: ["12","31","06:26","08:03","12:09","13:45","14:15","16:04","17:41"]
    // 2024-01-01: ["1","1","06:26","08:03","12:09","13:46","14:16","16:05","17:42"]
    const lastDayDecTimes = await londonShafi.getDay(utc(2023, 12, 31));
    const firstJanTimes = await londonShafi.getDay(utc(2024, 1, 1));

    expect(firstJanTimes[Prayer.Fajr]).toBePrayer(
      Prayer.Fajr,
      utc(2024, 1, 1, 6, 26)
    );

    expect(lastDayDecTimes[Prayer.Isha]).toBePrayer(
      Prayer.Isha,
      utc(2023, 12, 31, 17, 41)
    );

    const prayerAfterLastDayDecIsha = await londonShafi.getNext(
      lastDayDecTimes[Prayer.Isha].time
    );

    expect(prayerAfterLastDayDecIsha).toEqual(firstJanTimes[Prayer.Fajr]);

    const prayerBeforeFirstJanFajr = await londonShafi.getPrev(
      firstJanTimes[Prayer.Fajr]
    );
    expect(prayerBeforeFirstJanFajr).toEqual(lastDayDecTimes[Prayer.Isha]);
  });
});

describe("Belfast Prayer Times", () => {
  const belfast = new BelfastPrayerTimes();

  // 2019-07-08: ["7","8","01:58","03:56","12:30","16:57",null,"21:01","22:50"]
  it("Should allow getting a prayer day", async () => {
    const julyEighthTimes = await belfast.getDay(utc(2019, 7, 8, 6));

    expect(julyEighthTimes[Prayer.Fajr]).toBePrayer(
      Prayer.Fajr,
      utc(2019, 7, 8, 1, 58)
    );

    expect(julyEighthTimes[Prayer.Asr]).toBePrayer(
      Prayer.Asr,
      utc(2019, 7, 8, 16, 57)
    );

    expect(julyEighthTimes[Prayer.Isha]).toBePrayer(
      Prayer.Isha,
      utc(2019, 7, 8, 22, 50)
    );
  });
});

describe("Timezone independence", () => {
  // These pin the behaviour the whole suite now relies on: the timetable is
  // read and rendered in its own zone, so results do not move with the device.
  // Before this, the suite had to be pinned to Europe/London to pass at all.

  it("Should pick the day by UK date, not the device's", async () => {
    // 23:30 UTC on 4 August is already the 5th in London, and still the 4th in
    // Los Angeles. The London row is the right answer in both places.
    const lateEvening = new Date("2026-08-04T23:30:00Z");
    const times = await londonShafi.getDay(lateEvening);

    // 2026-08-05: ["8","5","02:47","04:27","12:12","16:14","17:20","19:46","20:50"]
    expect(times[Prayer.Fajr]).toBePrayer(Prayer.Fajr, utc(2026, 8, 5, 2, 47));
  });

  it("Should cross into the next day by UK date", async () => {
    // Isha on the 5th is 20:50 UTC; the next prayer is Fajr on the 6th.
    const afterIsha = new Date("2026-08-05T21:00:00Z");
    const next = await londonShafi.getNext(afterIsha);

    // 2026-08-06 fajr is 02:48 UTC
    expect(next.prayer).toEqual(Prayer.Fajr);
    expect(next.time).toEqual(utc(2026, 8, 6, 2, 48));
  });

  it("Should step a whole day when the UK clocks change", async () => {
    // The UK springs forward on 2026-03-29. A flat 24 hours from late on the
    // 28th skips the 29th entirely, which would have hidden a day of prayers.
    // Isha on the 28th is 19:47 UTC, so late evening is past every prayer and
    // the answer has to come from the 29th: fajr at 03:08 UTC.
    const lateOn28th = new Date("2026-03-28T23:00:00Z");
    const next = await londonShafi.getNext(lateOn28th);

    expect(next.prayer).toEqual(Prayer.Fajr);
    expect(next.time).toEqual(utc(2026, 3, 29, 3, 8));
  });
});
