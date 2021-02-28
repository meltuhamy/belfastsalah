import { Prayer, AsrMethod } from "./PrayerTimes";

export enum PrayerLocation {
  London = "london",
  Belfast = "belfast"
}

export type PrayerDay = Array<PrayerData>;
export type PrayerMonth = Array<PrayerDay>;
export type PrayerYear = Array<PrayerMonth>;

type DateConfig = {
  month: number;
  day: number;
  hours: number;
  minutes: number;
};

export class PrayerData {
  dateConfig: DateConfig;
  prayer: Prayer;

  constructor(date: DateConfig, prayer: Prayer) {
    this.dateConfig = date;
    this.prayer = prayer;
  }

  toDate(year: number): Date {
    const { month, day, hours, minutes } = this.dateConfig;
    return new Date(Date.UTC(year, month, day, hours, minutes));
  }
}

function parsePrayerData(
  data: Array<Array<string>>,
  asrMethod: AsrMethod
): Array<Array<Array<PrayerData>>> {
  const year: PrayerYear = new Array(12);

  data.forEach(dayData => {
    const [month, day, fajr, shuruq, duhr, asr, asr2, maghrib, isha] = dayData;
    if (asrMethod === AsrMethod.Hanafi && !asr2) {
      throw new Error("Asr method not supported for this location");
    }

    const prayerTimeStrings = [
      fajr,
      shuruq,
      duhr,
      asrMethod === AsrMethod.Shafi ? asr : asr2,
      maghrib,
      isha
    ];

    const monthNum = +month - 1;
    const dayNum = +day;

    const prayers = prayerTimeStrings.map((p, pIndex) => {
      let split = p.split(":");
      let hours = +split[0];
      let minutes = +split[1];

      return new PrayerData(
        { month: monthNum, day: dayNum, hours, minutes },
        pIndex
      );
    });

    if (!year[monthNum]) {
      year[monthNum] = [];
    }

    year[monthNum].push(prayers);
  });

  return year;
}

function sort(arr: Array<number>) {
  return [...arr].sort((a, b) => a - b);
}

function getAvailableYear(
  targetYear: number,
  location: PrayerLocation
): number {
  const availableYears = sort(
    {
      [PrayerLocation.Belfast]: [2019],
      [PrayerLocation.London]: [2019, 2020, 2021, 2022, 2023, 2024]
    }[location]
  );

  for (let i = 0; i < availableYears.length; i++) {
    if (availableYears[i] >= targetYear) {
      return availableYears[i];
    }
  }

  return availableYears[availableYears.length - 1];
}

const getPrayerYearCache: Map<string, PrayerYear> = new Map();
export async function getPrayerData(
  location: PrayerLocation,
  asrMethod: AsrMethod,
  targetYear: number
): Promise<PrayerYear> {
  const year = getAvailableYear(targetYear, location);
  const cacheKey = JSON.stringify({ location, asrMethod, year });
  const cacheResult = getPrayerYearCache.get(cacheKey);
  if (cacheResult) {
    return cacheResult;
  }

  const data = await import(`../prayer_data/${location}-${year}.json`);
  const prayerYear = parsePrayerData(data.default, asrMethod);
  getPrayerYearCache.set(cacheKey, prayerYear);
  return prayerYear;
}

export async function getDay(
  date: Date,
  location: PrayerLocation,
  asrMethod: AsrMethod
) {
  const prayerData = await getPrayerData(
    location,
    asrMethod,
    date.getFullYear()
  );
  return prayerData[date.getMonth()][date.getDate() - 1];
}
