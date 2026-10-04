// Imports the London Unified Prayer Timetable's own spreadsheets, from
// https://londonsalahtimes.com/downloads/, into src/prayer_data as UTC.
//
//   node scripts/timetables/lupt-to-utc-json.js 2026 2076
//
// imports every year from the first to the last, inclusive. Downloads are
// kept in scripts/timetables/data/lupt (not committed), so a rerun works
// offline; delete a file there to fetch it again.
//
// These sheets change their clocks on the real dates, unlike the older
// spreadsheets that spreadsheet-to-utc-json.js reads, so each time is
// converted with Europe/London's offset on its own date. The script checks
// that rather than trusting it: a sheet whose hour jumps fall anywhere else
// is refused.

import readExcelFile from "read-excel-file/node";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.resolve(scriptDir, "data", "lupt");
const outputDir = path.resolve(scriptDir, "..", "..", "src", "prayer_data");
const downloadUrl = (year) =>
  `https://londonsalahtimes.com/downloads/LUPT-${year}.xlsx`;

async function download(year) {
  const file = path.join(cacheDir, `LUPT-${year}.xlsx`);
  if (!fs.existsSync(file)) {
    const response = await fetch(downloadUrl(year));
    if (!response.ok) {
      throw new Error(`${downloadUrl(year)}: HTTP ${response.status}`);
    }
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  return file;
}

// A cell holding a time comes back as that time on 30 December 1899, UTC.
function clockMinutes(cell) {
  if (!(cell instanceof Date) || cell.getUTCSeconds() !== 0) {
    throw new Error(`Not a time to the minute: ${cell}`);
  }
  return cell.getUTCHours() * 60 + cell.getUTCMinutes();
}

// Some years' files only have a 12-hour sheet, which stores Asr at 4pm as
// 04:00. Zuhr is never before 11am and the rest are never before noon, so
// anything earlier is the afternoon. On a 24-hour sheet this changes nothing.
const afternoonFrom = [null, null, 10 * 60, 12 * 60, 12 * 60, 12 * 60, 12 * 60];
function toTwentyFourHour(minutes, column) {
  const from = afternoonFrom[column];
  return from != null && minutes < from ? minutes + 12 * 60 : minutes;
}

// Minutes Europe/London is ahead of UTC at midday on the given date. Every
// prayer is well clear of the 1-2am change, so midday's offset is the day's.
const londonParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function londonOffset(year, month, day) {
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12));
  const parts = Object.fromEntries(
    londonParts.formatToParts(noonUtc).map((p) => [p.type, p.value])
  );
  return +parts.hour * 60 + +parts.minute - 12 * 60;
}

const pad = (n) => String(n).padStart(2, "0");
const toTime = (minutes) => {
  const wrapped = (minutes + 24 * 60) % (24 * 60);
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`;
};

async function importYear(year) {
  const sheets = await readExcelFile(await download(year));
  const sheet =
    sheets.find((s) => s.sheet === "24-hr format") ??
    sheets.find((s) => s.sheet !== "12-hr format") ??
    sheets[0];

  // A day's row: [, date, date, fajr, sunrise, zuhr, asr, asr (mithl 2),
  // maghrib, isha, , islamic date]. Everything else is headings.
  const days = sheet.data.filter(
    (row) => row[1] instanceof Date && row[3] instanceof Date
  );
  const expected = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  if (days.length !== expected) {
    throw new Error(`${year}: ${days.length} days, expected ${expected}`);
  }

  let previousFajr = null;
  let previousOffset = null;
  const output = days.map((row, index) => {
    const date = row[1];
    const [y, month, day] = [
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    ];
    const expectedDate = new Date(Date.UTC(year, 0, 1 + index));
    if (date.getTime() !== expectedDate.getTime()) {
      throw new Error(`${year}: row ${index + 1} is ${date.toISOString()}`);
    }

    const clock = row
      .slice(3, 10)
      .map((cell, column) => toTwentyFourHour(clockMinutes(cell), column));
    const offset = londonOffset(y, month, day);

    // The sheet's own clock changes have to be the real ones.
    if (previousFajr != null) {
      const jump = clock[0] - previousFajr;
      const sheetChanged = Math.abs(jump) > 30;
      const realChanged = offset !== previousOffset;
      if (sheetChanged !== realChanged) {
        throw new Error(
          `${year}: Fajr jumps ${jump} minutes on ${day}/${month}, ` +
            `but the UK clocks ${realChanged ? "do" : "do not"} change then`
        );
      }
    }
    previousFajr = clock[0];
    previousOffset = offset;

    return [String(month), String(day), ...clock.map((m) => toTime(m - offset))];
  });

  // Every file carries a 29 February; outside leap years it repeats the 28th
  // and is never shown (see the note on getMonth in CLAUDE.md).
  if (expected === 365) {
    const copy = output[58].slice();
    copy[1] = "29";
    output.splice(59, 0, copy);
  }

  const file = path.join(outputDir, `london-${year}.json`);
  fs.writeFileSync(file, JSON.stringify(output).replace(/],/g, "],\n"));
  console.log(`london-${year}.json`);
}

const [first, last = first] = process.argv.slice(2).map(Number);
if (!first) {
  console.error("Usage: node scripts/timetables/lupt-to-utc-json.js <first year> [last year]");
  process.exit(1);
}
for (let year = first; year <= last; year++) {
  await importYear(year);
}
