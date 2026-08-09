// ESM rather than CommonJS: package.json declares "type": "module", so a
// `require` in here is a syntax error rather than a working script.
import csv from "csvtojson";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

process.env.TZ = "Europe/London";
// force london tz

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

function toUTC(timeString, dateString, year) {
  const date = new Date(`${dateString}, ${year} ${timeString}:00`);
  return `${leftFillNum(date.getUTCHours())}:${leftFillNum(
    date.getUTCMinutes()
  )}`;
}
function isLeap(year) {
  return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}
function jsonArrayToOutputArray(jsonArray, year) {
  const output = jsonArray.map((originalData) => [
    originalData.month,
    originalData.day,
    toUTC(originalData.fajr, originalData.date, year),
    toUTC(originalData.shuruq, originalData.date, year),
    toUTC(originalData.duhr, originalData.date, year),
    toUTC(originalData.asr1, originalData.date, year),
    toUTC(originalData.asr2, originalData.date, year),
    toUTC(originalData.maghrib, originalData.date, year),
    toUTC(originalData.isha, originalData.date, year),
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
