import { addDays, subDays, getDaysInMonth } from "date-fns";
import { getDay, PrayerData } from "./PrayerTimeData";

export enum PrayerLocation {
  London = "london",
  Belfast = "belfast"
}

export enum Prayer {
  Fajr,
  Shuruq,
  Duhr,
  Asr,
  Maghrib,
  Isha
}

export enum AsrMethod {
  Shafi = "shafi",
  Hanafi = "hanafi"
}

export type PrayerDay = Array<Prayer>;
export type PrayerMonth = Array<PrayerDay>;
export type PrayerYear = Array<PrayerMonth>;

export class PrayerTime {
  prayer: Prayer;
  time: Date;

  constructor(prayer: PrayerData, year: number) {
    this.prayer = prayer.prayer;
    this.time = prayer.toDate(year);
  }
}
export type PrayerDayTimes = [
  PrayerTime,
  PrayerTime,
  PrayerTime,
  PrayerTime,
  PrayerTime,
  PrayerTime
];

export type PrayerTimesConfig = {
  getDay: (date: Date) => Promise<PrayerDayTimes>;
};

export class PrayerTimes {
  config: PrayerTimesConfig;

  constructor(config: PrayerTimesConfig) {
    this.config = config;
  }

  async getDay(date: Date) {
    return await this.config.getDay(date);
  }

  // given a time, get the next prayer after it
  async getNext(dateOrPrayerTime: Date | PrayerTime) {
    const date =
      dateOrPrayerTime instanceof Date
        ? dateOrPrayerTime
        : dateOrPrayerTime.time;
    const prayerDay = await this.getDay(date);
    for (let i = 0; i < prayerDay.length; i++) {
      if (prayerDay[i].time > date) {
        return prayerDay[i];
      }
    }

    // haven't found next prayer of this day, get fajr of next day
    const nextDay = addDays(date, 1);
    const nextPrayerDay = await this.getDay(nextDay);
    return nextPrayerDay[Prayer.Fajr];
  }

  async getPrev(dateOrPrayerTime: Date | PrayerTime) {
    const date =
      dateOrPrayerTime instanceof Date
        ? dateOrPrayerTime
        : dateOrPrayerTime.time;
    const prayerDay = await this.getDay(date);
    for (let i = prayerDay.length - 1; i >= 0; i--) {
      if (prayerDay[i].time < date) {
        return prayerDay[i];
      }
    }

    // haven't found next prayer of this day, get isha of prev day
    const prevDay = subDays(date, 1);
    const prevPrayerDay = await this.getDay(prevDay);
    return prevPrayerDay[Prayer.Isha];
  }

  async getMonth(month: number, year: number): Promise<Array<PrayerDayTimes>> {
    const numDays = getDaysInMonth(new Date(year, month));
    const promises = [];
    for (let i = 0; i < numDays; i++) {
      promises.push(this.getDay(new Date(year, month, i + 1)));
    }
    return await Promise.all(promises);
  }
}

export class LondonPrayerTimes extends PrayerTimes {
  constructor(asrMethod: AsrMethod) {
    super({
      async getDay(date: Date) {
        const day = await getDay(date, PrayerLocation.London, asrMethod);
        return day.map(
          p => new PrayerTime(p, date.getFullYear())
        ) as PrayerDayTimes;
      }
    });
  }
}

export class BelfastPrayerTimes extends PrayerTimes {
  constructor() {
    super({
      async getDay(date: Date) {
        const day = await getDay(date, PrayerLocation.Belfast, AsrMethod.Shafi);
        return day.map(
          p => new PrayerTime(p, date.getFullYear())
        ) as PrayerDayTimes;
      }
    });
  }
}

export function prayerToString(prayer: Prayer): string {
  switch (prayer) {
    case Prayer.Fajr:
      return "Fajr";
    case Prayer.Shuruq:
      return "Shuruq";
    case Prayer.Duhr:
      return "Duhr";
    case Prayer.Asr:
      return "Asr";
    case Prayer.Maghrib:
      return "Maghrib";
    case Prayer.Isha:
      return "Isha";
  }
}

export default function supportsHanafiAsr(location: PrayerLocation): boolean {
  switch (location) {
    case PrayerLocation.Belfast:
      return false;
    case PrayerLocation.London:
      return true;
  }
}
