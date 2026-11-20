import { Prayer, AsrMethod } from "./PrayerTimes";
import { UK_TIME_ZONE, getZonedDateParts } from "./timeZone";
import { calculateLondonYear } from "./londonCalculation";
import { calculateIstanbulYear } from "./istanbulCalculation";

export enum PrayerLocation {
  London = "london",
  Belfast = "belfast",
  Istanbul = "istanbul"
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

// The single source of truth for which years we have data for is the files in
// src/prayer_data themselves: every <location>-<year>.json is served, and
// nothing else is - so the two can never drift apart the way a hand-maintained
// list of year numbers can. Add a year by adding its file and nowhere else.
const prayerDataFiles = import.meta.glob<{ default: Array<PrayerDataRow> }>(
  "../prayer_data/*-*.json"
);

const prayerDataLoaders = Object.fromEntries(
  Object.values(PrayerLocation).map(location => [location, {}])
) as Record<PrayerLocation, Record<number, PrayerDataLoader>>;

for (const [file, loader] of Object.entries(prayerDataFiles)) {
  const match = /\/([a-z]+)-(\d{4})\.json$/.exec(file);
  const location = match?.[1] as PrayerLocation | undefined;
  if (match && location && location in prayerDataLoaders) {
    prayerDataLoaders[location][Number(match[2])] = loader;
  }
}

// Each timetable is published in its city's local time, so the timetable's own
// zone - not the device's - decides which day's row applies.
export const locationTimeZones: Record<PrayerLocation, string> = {
  [PrayerLocation.Belfast]: UK_TIME_ZONE,
  [PrayerLocation.London]: UK_TIME_ZONE,
  [PrayerLocation.Istanbul]: "Europe/Istanbul"
};

// The timetable zone for whatever is chosen, and the UK's before anything is.
export function timetableZoneFor(location: PrayerLocation | null): string {
  return location == null ? UK_TIME_ZONE : locationTimeZones[location];
}

// One place to name a location, so the picker and the timezone copy can never
// disagree about what a location is called.
export const locationNames: Record<PrayerLocation, string> = {
  [PrayerLocation.Belfast]: "Belfast",
  [PrayerLocation.London]: "London",
  [PrayerLocation.Istanbul]: "Istanbul"
};

export function getAvailableYears(location: PrayerLocation): Array<number> {
  // map() already returns a fresh array. sort() keeps the year order without
  // Array.prototype.toSorted, which older Android WebViews (Chrome 101) lack.
  return Object.keys(prayerDataLoaders[location])
    .map(Number)
    .sort((a, b) => a - b);
}

// London's times after its last file are calculated on the device, the way
// the timetable itself calculates them (londonCalculation.ts). The files that
// remain, 2022 to 2026, came from older spreadsheets that differ from the
// calculation by a minute on many days, and are what users already saw.
const calculators: Partial<
  Record<PrayerLocation, (year: number) => Array<PrayerDataRow>>
> = {
  [PrayerLocation.London]: calculateLondonYear,
  // Istanbul has no files at all: every year is calculated.
  [PrayerLocation.Istanbul]: calculateIstanbulYear
};

// Pick the year to serve. A location that can be calculated uses a file only
// for that file's own year, and calculates every year after its first file
// that has none - so a file added for a later year never stands in for the
// years before it; one with no files at all calculates every year. Before the
// first file, and for a location that cannot be calculated, it is the nearest
// file above, otherwise the latest one.
export function chooseYear(
  targetYear: number,
  availableYears: Array<number>,
  canCalculate: boolean
): { year: number; calculated: boolean } {
  if (
    canCalculate &&
    (availableYears.length === 0 || targetYear > availableYears[0]) &&
    !availableYears.includes(targetYear)
  ) {
    return { year: targetYear, calculated: true };
  }

  for (let i = 0; i < availableYears.length; i++) {
    if (availableYears[i] >= targetYear) {
      return { year: availableYears[i], calculated: false };
    }
  }

  return { year: availableYears[availableYears.length - 1], calculated: false };
}

// A calculated year's rows carry both asr columns, so they are worked out once
// per year and shared by both asr methods; only the parsing below is per
// method.
const calculatedRows: Map<string, Array<PrayerDataRow>> = new Map();
function getCalculatedRows(
  location: PrayerLocation,
  year: number
): Array<PrayerDataRow> {
  const key = `${location}-${year}`;
  let rows = calculatedRows.get(key);
  if (!rows) {
    rows = calculators[location]!(year);
    calculatedRows.set(key, rows);
  }
  return rows;
}

const getPrayerYearCache: Map<string, PrayerYear> = new Map();
export async function getPrayerData(
  location: PrayerLocation,
  asrMethod: AsrMethod,
  targetYear: number
): Promise<PrayerYear> {
  const { year, calculated } = chooseYear(
    targetYear,
    getAvailableYears(location),
    Boolean(calculators[location])
  );
  const cacheKey = JSON.stringify({ location, asrMethod, year });
  const cacheResult = getPrayerYearCache.get(cacheKey);
  if (cacheResult) {
    return cacheResult;
  }

  const rows = calculated
    ? getCalculatedRows(location, year)
    : (await prayerDataLoaders[location][year]()).default;
  const prayerYear = parsePrayerData(rows, asrMethod);
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
