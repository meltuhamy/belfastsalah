// ESM rather than CommonJS: package.json declares "type": "module", so a
// `require` in here is a syntax error rather than a working script.
import csv from "csvtojson";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

// The spreadsheets are in UK clock time, but a sheet can move its clocks on
// dates of its own: 2025's and 2026's change on 1 April and 28 October, while
// the real changes are the last Sundays of March and October. Converting with
// the real dates put the days in between an hour out - Fajr at 06:03 on
// 25 October 2026 instead of 05:03. So each row is converted with the offset
// the sheet itself is using, read off its own hour jumps, rather than the one
// the calendar says. For a sheet that changes on the real dates the two agree.

async function getData(location, year) {
  const filePath = path.resolve(scriptDir, "data", `${location}-${year}.csv`);
  return await csv({
    headers: [
      "date",
      "month",
      "day",
      "fajr",
      "shuruq",
      "duhr",
      "asr1",
      "asr2",
      "maghrib",
      "isha",
    ],
  }).fromFile(filePath);
}

function leftFillNum(num) {
  return num.toString().padStart(2, 0);
}

function toMinutes(timeString) {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

function toUTC(timeString, sheetOffsetMinutes) {
  const minutes = (toMinutes(timeString) - sheetOffsetMinutes + 24 * 60) % (24 * 60);
  return `${leftFillNum(Math.floor(minutes / 60))}:${leftFillNum(minutes % 60)}`;
}

// No prayer moves by more than a few minutes from one day to the next, so a
// jump of more than half an hour in Fajr is the sheet changing its clocks.
// January is always GMT.
function sheetOffsets(jsonArray) {
  let offset = 0;
  return jsonArray.map((row, index) => {
    if (index > 0) {
      const jump = toMinutes(row.fajr) - toMinutes(jsonArray[index - 1].fajr);
      if (jump > 30) offset = 60;
      if (jump < -30) offset = 0;
    }
    return offset;
  });
}

function isLeap(year) {
  return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}
function jsonArrayToOutputArray(jsonArray, year) {
  const offsets = sheetOffsets(jsonArray);
  const output = jsonArray.map((originalData, index) => [
    originalData.month,
    originalData.day,
    ...["fajr", "shuruq", "duhr", "asr1", "asr2", "maghrib", "isha"].map(
      (prayer) => toUTC(originalData[prayer], offsets[index])
    ),
  ]);

  if (!isLeap(year)) {
    const copied = output[58].slice();
    copied[1] = "29"; //pretend to be 29th
    return output
      .slice(0, 59)
      .concat([copied])
      .concat(output.slice(59, output.length));
  }

  return output;
}

async function processCSV(location, year) {
  const jsonArray = await getData(location, year);
  const outputArray = jsonArrayToOutputArray(jsonArray, year);
  writeJSONFile(outputArray, location, year);
}

function writeJSONFile(data, location, year) {
  const filePath = path.resolve(
    scriptDir,
    "..",
    "src",
    "prayer_data",
    `${location}-${year}.json`
  );
  const dataAsString = JSON.stringify(data).replace(/],/gi, "],\n");

  fs.writeFileSync(filePath, dataAsString);
}

processCSV("london", 2022);
processCSV("london", 2023);
processCSV("london", 2024);
processCSV("london", 2025);
processCSV("london", 2026);
