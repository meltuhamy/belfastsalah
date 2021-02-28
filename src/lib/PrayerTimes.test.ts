import {
  LondonPrayerTimes,
  PrayerTime,
  AsrMethod,
  Prayer,
} from "./PrayerTimes";

const londonShafi = new LondonPrayerTimes(AsrMethod.Shafi);
const londonHanafi = new LondonPrayerTimes(AsrMethod.Hanafi);

declare global {
  namespace jest {
    interface Matchers<R> {
      toBePrayer(prayer: Prayer, time: Date): R;
    }
  }
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
      message = message + "Has matchin time " + time;
    } else {
      message =
        message +
        "Times not matching. Expected " +
        time +
        ". Received " +
        received.time;
    }

    return { pass: matchingPrayer && matchingTime, message: () => message };
  },
});

describe("London Prayer Times", () => {
  it("Should allow getting a prayer day with shafi asr", async () => {
    const julyEighthTimes = await londonShafi.getDay(
      new Date("July 8, 1995 06:00:00")
    );
    //  UTC: ["7", "8", "01:57", "03:50", "12:11", "16:26", "17:40", "20:20", "21:30"],
    expect(julyEighthTimes[Prayer.Fajr]).toBePrayer(
      Prayer.Fajr,
      new Date("July 8, 1995 02:57:00") // add an hour because of utc
    );

    expect(julyEighthTimes[Prayer.Shuruq]).toBePrayer(
      Prayer.Shuruq,
      new Date("July 8, 1995 04:50:00") // add an hour because of utc
    );

    expect(julyEighthTimes[Prayer.Duhr]).toBePrayer(
      Prayer.Duhr,
      new Date("July 8, 1995 13:11:00") // add an hour because of utc
    );

    expect(julyEighthTimes[Prayer.Asr]).toBePrayer(
      Prayer.Asr,
      new Date("July 8, 1995 17:26:00") // add an hour because of utc
    );

    expect(julyEighthTimes[Prayer.Maghrib]).toBePrayer(
      Prayer.Maghrib,
      new Date("July 8, 1995 21:21:00") // add an hour because of utc
    );

    expect(julyEighthTimes[Prayer.Isha]).toBePrayer(
      Prayer.Isha,
      new Date("July 8, 1995 22:31:00") // add an hour because of utc
    );
  });

  it("Should allow getting a prayer day with hanafi asr", async () => {
    const julyEighthTimes = await londonHanafi.getDay(
      new Date("July 8, 1995 06:00:00")
    );
    //  UTC: ["7", "8", "01:57", "03:50", "12:11", "16:26", "17:40", "20:20", "21:30"],
    expect(julyEighthTimes[Prayer.Fajr]).toBePrayer(
      Prayer.Fajr,
      new Date("July 8, 1995 02:57:00") // add an hour because of utc
    );

    expect(julyEighthTimes[Prayer.Shuruq]).toBePrayer(
      Prayer.Shuruq,
      new Date("July 8, 1995 04:50:00") // add an hour because of utc
    );

    expect(julyEighthTimes[Prayer.Duhr]).toBePrayer(
      Prayer.Duhr,
      new Date("July 8, 1995 13:11:00") // add an hour because of utc
    );

    expect(julyEighthTimes[Prayer.Asr]).toBePrayer(
      Prayer.Asr,
      new Date("July 8, 1995 18:40:00") // add an hour because of utc
    );

    expect(julyEighthTimes[Prayer.Maghrib]).toBePrayer(
      Prayer.Maghrib,
      new Date("July 8, 1995 21:21:00") // add an hour because of utc
    );

    expect(julyEighthTimes[Prayer.Isha]).toBePrayer(
      Prayer.Isha,
      new Date("July 8, 1995 22:31:00") // add an hour because of utc
    );
  });

  it("Should allow getting next/prev prayers by Date object", async () => {
    const nextPrayerAfterMidnight = await londonShafi.getNext(
      new Date("July 8, 1995 00:00:00")
    );

    expect(nextPrayerAfterMidnight).toBePrayer(
      Prayer.Fajr,
      new Date("July 8, 1995 02:57")
    );

    // 3 minutes later, prev prayer should be fajr
    const prayerBeforeAt3AM = await londonShafi.getPrev(
      new Date("July 8, 1995 03:00")
    );

    expect(prayerBeforeAt3AM).toBePrayer(
      Prayer.Fajr,
      new Date("July 8, 1995 02:57")
    );
  });

  it("Should allow getting next/prev prayers by PrayerTime object", async () => {
    const julyEighthTimes = await londonShafi.getDay(
      new Date("July 8, 1995 06:00:00")
    );

    const afterFajr = await londonShafi.getNext(julyEighthTimes[Prayer.Fajr]);

    expect(afterFajr).toBePrayer(
      Prayer.Shuruq,
      new Date("July 8, 1995 04:50:00")
    );

    const beforeShuruq = await londonShafi.getPrev(afterFajr);
    expect(beforeShuruq).toEqual(julyEighthTimes[Prayer.Fajr]);
  });

  it("Should allow getting next/prev prayers for a day", async () => {
    const dayTimes = await londonShafi.getDay(
      new Date("July 8, 1995 00:00:00")
    );
    const nextPrayerAfterMidnight = await londonShafi.getNext(
      new Date("July 8, 1995 00:00:00")
    );

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
    const day1Times = await londonShafi.getDay(
      new Date("July 8, 1995 00:00:00")
    );
    const day2Times = await londonShafi.getDay(
      new Date("July 9, 1995 00:00:00")
    );

    const prayerAfterDay1Isha = await londonShafi.getNext(
      day1Times[Prayer.Isha]
    );

    expect(prayerAfterDay1Isha).toEqual(day2Times[Prayer.Fajr]);

    const prayerBeforeDay1Isha = await londonShafi.getPrev(prayerAfterDay1Isha);
    expect(prayerBeforeDay1Isha).toEqual(day1Times[Prayer.Isha]);
  });

  it("Should allow getting next prayers between months", async () => {
    const lastDayOfJuly = new Date("July 31, 1995 00:00:00");
    const lastDayOfJulyTimes = await londonShafi.getDay(lastDayOfJuly);
    const firstDayOfAugustTimes = await londonShafi.getDay(
      new Date("August 1, 1995 00:00:00")
    );

    const prayerAfterIshaOnLastDayOfJuly = await londonShafi.getNext(
      lastDayOfJulyTimes[Prayer.Isha].time
    );

    expect(prayerAfterIshaOnLastDayOfJuly).toEqual(
      firstDayOfAugustTimes[Prayer.Fajr]
    );

    expect(firstDayOfAugustTimes[Prayer.Fajr]).toBePrayer(
      Prayer.Fajr,
      new Date("August 1, 1995 03:39:00")
    );

    const prayerBefore = await londonShafi.getPrev(
      prayerAfterIshaOnLastDayOfJuly
    );

    expect(prayerBefore).toEqual(lastDayOfJulyTimes[Prayer.Isha]);
  });

  it("Should allow getting next/prev prayers in feb during a non-leap year", async () => {
    // ["2", "28", "05:08", "06:45", "12:18", "15:03", "15:47", "17:42", "19:09"],
    // ["3", "1", "05:06", "06:43", "12:18", "15:04", "15:48", "17:44", "19:10"],
    const lastDayFebTimes = await londonShafi.getDay(
      new Date("February 28, 1995 00:00:00")
    );

    expect(lastDayFebTimes[Prayer.Isha]).toBePrayer(
      Prayer.Isha,
      new Date("February 28, 1995 19:08")
    );

    const firstDayMarchTimes = await londonShafi.getDay(
      new Date("March 1, 1995 00:00:00")
    );

    expect(firstDayMarchTimes[Prayer.Fajr]).toBePrayer(
      Prayer.Fajr,
      new Date("March 1, 1995 05:06:00")
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
    // ["2", "28", "05:08", "06:45", "12:18", "15:03", "15:47", "17:42", "19:09"],
    // ["2", "29", "05:08", "06:45", "12:18", "15:03", "15:47", "17:42", "19:09"],
    // ["3", "1", "05:06", "06:43", "12:18", "15:04", "15:48", "17:44", "19:10"],
    const secondLastDayFebTimes = await londonShafi.getDay(
      new Date("February 28, 1992 00:00:00")
    );

    const lastDayFebTimes = await londonShafi.getDay(
      new Date("February 29, 1992 00:00:00")
    );

    expect(lastDayFebTimes[Prayer.Isha]).toBePrayer(
      Prayer.Isha,
      new Date("February 29, 1992 19:08")
    );

    const firstDayMarchTimes = await londonShafi.getDay(
      new Date("March 1, 1992 00:00:00")
    );

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
    // ["12", "31", "06:26", "08:03", "12:08", "13:45", "14:15", "16:04", "17:41"]
    // ["1", "1", "06:26", "08:03", "12:09", "13:46", "14:17", "16:05", "17:42"]
    const lastDayDecTimes = await londonShafi.getDay(
      new Date("December 31, 1995 00:00")
    );

    const firstJanTimes = await londonShafi.getDay(
      new Date("January 1, 1996 00:00")
    );

    expect(firstJanTimes[Prayer.Fajr]).toBePrayer(
      Prayer.Fajr,
      new Date("January 1, 1996 06:26")
    );

    expect(lastDayDecTimes[Prayer.Isha]).toBePrayer(
      Prayer.Isha,
      new Date("December 31, 1995 17:41")
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
