import { Prayer, AsrMethod } from "./PrayerTimes";
import { UK_TIME_ZONE, getZonedDateParts } from "./timeZone";

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

// Timetables that only publish one asr column leave the second one null, so a
// row is a list of times with holes rather than a list of strings.
export type PrayerDataRow = Array<string | null>;

function parsePrayerData(
  data: Array<PrayerDataRow>,
  asrMethod: AsrMethod
): Array<Array<Array<PrayerData>>> {
  const year: PrayerYear = Array.from({ length: 12 });

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

    const monthNum = +month! - 1;
    const dayNum = +day!;

    const prayers = prayerTimeStrings.map((p, pIndex) => {
      if (p == null) {
        throw new Error(
          `Missing prayer time for month ${month} day ${day} at index ${pIndex}`
        );
      }

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

type PrayerDataLoader = () => Promise<{ default: Array<PrayerDataRow> }>;

// The single source of truth for which years we have data for. Every entry
// must point at a file that exists, and any file not listed here is not
// served — so the two can never drift apart the way a hand-maintained list of
// year numbers can. Add a year by adding a line here and nowhere else.
const prayerDataLoaders: Record<
  PrayerLocation,
  Record<number, PrayerDataLoader>
> = {
  [PrayerLocation.Belfast]: {
    2019: () => import("../prayer_data/belfast-2019.json")
  },
  [PrayerLocation.London]: {
    2022: () => import("../prayer_data/london-2022.json"),
    2023: () => import("../prayer_data/london-2023.json"),
    2024: () => import("../prayer_data/london-2024.json"),
    2025: () => import("../prayer_data/london-2025.json"),
    2026: () => import("../prayer_data/london-2026.json")
  }
};

// The timetables are published as UK local times, so the timetable's own zone
// - not the device's - decides which day's row applies.
export const locationTimeZones: Record<PrayerLocation, string> = {
  [PrayerLocation.Belfast]: UK_TIME_ZONE,
  [PrayerLocation.London]: UK_TIME_ZONE
};

export function getAvailableYears(location: PrayerLocation): Array<number> {
  return Object.keys(prayerDataLoaders[location])
    .map(Number)
    .toSorted((a, b) => a - b);
}

// Pick the closest year we can actually serve: an exact match when we have
// it, otherwise the nearest year above, otherwise the latest year we hold.
function getAvailableYear(
  targetYear: number,
  location: PrayerLocation
): number {
  const availableYears = getAvailableYears(location);

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

  const data = await prayerDataLoaders[location][year]();
  const prayerYear = parsePrayerData(data.default, asrMethod);
  getPrayerYearCache.set(cacheKey, prayerYear);
  return prayerYear;
}

export async function getDay(
  date: Date,
  location: PrayerLocation,
  asrMethod: AsrMethod
) {
  // Read the calendar date in the timetable's zone. Using the device's local
  // date meant anyone outside the UK was served the neighbouring day's times.
  const { year, month, day } = getZonedDateParts(
    date,
    locationTimeZones[location]
  );
  const prayerData = await getPrayerData(location, asrMethod, year);
  return { prayers: prayerData[month - 1][day - 1], year };
}
