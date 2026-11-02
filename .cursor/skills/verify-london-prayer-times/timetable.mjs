/**
 * Timetable rows, formatted the way the app prints them.
 *
 * The JSON stores UTC instants (month, day, fajr, shuruq, duhr, shafi asr,
 * hanafi asr, maghrib, isha). The screen prints those instants in
 * Europe/London: the JSON clock time in winter, an hour later during British
 * Summer Time. Shafi asr is the first asr column.
 *
 * Belfast publishes one file (belfast-2019.json). The app serves that file for
 * any later year and applies its clock times to the calendar year being
 * shown. London has a file per year; a missing london-<year>.json is a
 * failure, not a cue to borrow another year.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const UK_TIME_ZONE = "Europe/London";
export const PRAYER_NAMES = ["Fajr", "Shuruq", "Duhr", "Asr", "Maghrib", "Isha"];

export function zoneOffsetMinutes(timeZone, at = new Date()) {
  const parts = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at)) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }
  }
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return (asIfUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000;
}

/** Same rule as src/lib/timeZone.ts zonesAgree: offset, not zone name. */
export function zonesAgree(a, b, at = new Date()) {
  return zoneOffsetMinutes(a, at) === zoneOffsetMinutes(b, at);
}

export function londonNow(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(at);
  const get = (type) => parts.find((part) => part.type === type).value;
  const month = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: UK_TIME_ZONE,
      month: "numeric",
    }).format(at)
  );
  return {
    year: Number(get("year")),
    month,
    day: Number(get("day")),
    label: `${get("weekday")} ${get("day")} ${get("month")}`,
    monthName: new Intl.DateTimeFormat("en-GB", {
      timeZone: UK_TIME_ZONE,
      month: "long",
    }).format(at),
  };
}

function formatLondon(year, month, day, hhmm) {
  const [hours, minutes] = String(hhmm).split(":").map(Number);
  const instant = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

function loadRow(repoRoot, location, fileYear, month, day) {
  const file = join(repoRoot, "src", "prayer_data", `${location}-${fileYear}.json`);
  const rows = JSON.parse(readFileSync(file, "utf8"));
  const row = rows.find(
    (entry) => Number(entry[0]) === month && Number(entry[1]) === day
  );
  if (!row) {
    throw new Error(`${location}-${fileYear}.json has no row for ${month}/${day}`);
  }
  return { file, row };
}

function pack(row, instantYear, month, day, file) {
  const utc = {
    Fajr: row[2],
    Shuruq: row[3],
    Duhr: row[4],
    Asr: row[5],
    Maghrib: row[7],
    Isha: row[8],
  };
  return {
    file,
    utc,
    hanafiAsrUtc: row[6],
    expected: Object.fromEntries(
      Object.entries(utc).map(([name, hhmm]) => [
        name,
        formatLondon(instantYear, month, day, hhmm),
      ])
    ),
    hanafiAsr: row[6] ? formatLondon(instantYear, month, day, row[6]) : null,
  };
}

export function londonTimes(repoRoot, year, month, day) {
  const { file, row } = loadRow(repoRoot, "london", year, month, day);
  return pack(row, year, month, day, file);
}

export function resolveFileYear(repoRoot, location, targetYear) {
  const years = readdirSync(join(repoRoot, "src", "prayer_data"))
    .map((name) => new RegExp(`^${location}-(\\d{4})\\.json$`).exec(name))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);
  if (years.length === 0) {
    throw new Error(`no ${location}-<year>.json timetable`);
  }
  return years.find((year) => year >= targetYear) ?? years[years.length - 1];
}

export function belfastTimes(repoRoot, year, month, day) {
  const fileYear = resolveFileYear(repoRoot, "belfast", year);
  const { file, row } = loadRow(repoRoot, "belfast", fileYear, month, day);
  return pack(row, year, month, day, file);
}
