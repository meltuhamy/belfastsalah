// Compares London times calculated by src/lib/londonCalculation.ts with the
// London Unified Prayer Timetable's own files, and prints a summary: the
// number of days each time differs on, and the first few, with how far the
// unrounded time is past the minute.
//
//   node scripts/timetables/compare-london.mjs [fromYear] [toYear]
//
// Years default to 2027 to 2076, the ones the app calculates and no longer
// ships. A year missing from src/prayer_data is read from git at
// LONDON_FILES_REF (default: the commit that last had all of them), so the
// comparison works after the files are gone.
//
// WRITE_GAPS=<file> also writes the Fajr and Isha gaps read off the files, as
// JSON, which is where src/lib/londonGaps.ts came from.
//
// It loads the module through Vite, as the app does, so it runs the code the
// app ships. About a second for all fifty years.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";

const [from = 2027, to = 2076] = process.argv.slice(2).map(Number);
const ref = process.env.LONDON_FILES_REF ?? "03f7f535e57ed2ca1442313583cf485ab37e6574";

const readYear = year => {
  const file = `src/prayer_data/london-${year}.json`;
  const text = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8")
    : execFileSync("git", ["show", `${ref}:${file}`], { encoding: "utf8" });
  return JSON.parse(text);
};

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error"
});
const L = await vite.ssrLoadModule("/src/lib/londonCalculation.ts");

const columns = ["fajr", "sunrise", "zuhr", "asr", "asr2", "maghrib", "isha"];
const misses = Object.fromEntries(columns.map(c => [c, []]));
const gaps = { fajr: [], isha: [] };
const minutes = s => s.split(":").reduce((h, m) => h * 60 + +m, 0);
const started = performance.now();
let rows = 0;

for (let year = from; year <= to; year++) {
  const want = readYear(year);
  const got = L.calculateLondonYear(year);
  if (got.length !== want.length) {
    console.log(`${year}: ${got.length} rows, file has ${want.length}`);
  }
  const leap = new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29;
  want.forEach((w, i) => {
    rows++;
    const g = got[i] ?? [];
    if (g[0] !== w[0] || g[1] !== w[1]) {
      throw new Error(`${year} row ${i}: ${g[0]}-${g[1]}, file has ${w[0]}-${w[1]}`);
    }
    columns.forEach((c, k) => {
      if (g[k + 2] === w[k + 2]) return;
      const raw = L.londonTimes(year, +w[0], +w[1])[c];
      const past = raw === undefined ? "" : ` (+${(raw % 1).toFixed(5)})`;
      misses[c].push(`${year}-${w[0]}-${w[1]} file ${w[k + 2]} calc ${g[k + 2]}${past}`);
    });
    // A non-leap year's 29 February repeats the 28th, so it says nothing
    // about the gap on a real 29 February.
    if (leap || i !== 59) {
      (gaps.fajr[i] ??= new Set()).add(minutes(w[3]) - minutes(w[2]));
      (gaps.isha[i] ??= new Set()).add(minutes(w[8]) - minutes(w[7]));
    }
  });
}
await vite.close();

console.log(`${from}-${to}: ${rows} days, ${(performance.now() - started).toFixed(0)} ms`);
for (const c of columns) {
  const m = misses[c];
  console.log(`${c.padEnd(8)} ${String(m.length).padStart(5)} differ${m.length ? "   " + m.slice(0, 3).join(" | ") : ""}`);
}
for (const k of ["fajr", "isha"]) {
  const varying = gaps[k].filter(s => s.size > 1).length;
  if (varying) console.log(`${k} gap is not the same every year on ${varying} calendar days`);
}
if (process.env.WRITE_GAPS) {
  const first = sets => sets.map(s => [...s][0]);
  fs.writeFileSync(
    process.env.WRITE_GAPS,
    JSON.stringify({ fajr: first(gaps.fajr), isha: first(gaps.isha) })
  );
}
