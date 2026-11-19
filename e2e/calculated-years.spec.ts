import { test, expect } from "@playwright/test";
import { completeSetup, pinDate, todayTimes } from "./support/app";

// London from 2027 on is calculated on the device (src/lib/londonCalculation.ts)
// instead of read from a file. These are winter dates, so the UK is on GMT and
// the times on screen are the timetable's own strings.

test("shows a calculated year exactly as the timetable printed it", async ({
  page,
}) => {
  // london-2027.json, deleted once the app calculated it (it is in git at
  // 03f7f53): ["2","15","05:35","07:12","12:20","14:47","15:27","17:18","18:48"]
  await pinDate(page, "2027-02-15T10:00:00Z");
  await completeSetup(page);
  expect(await todayTimes(page)).toEqual({
    Fajr: "05:35",
    Shuruq: "07:12",
    Duhr: "12:20",
    Asr: "14:47",
    Maghrib: "17:18",
    Isha: "18:48",
  });
});

test("calculates years after the timetable ends instead of repeating 2076", async ({
  page,
}) => {
  // There is no timetable for 2099; these are the calculation's own. 2076's
  // 15 February, which the app used to show for every later year, was
  // 05:34 07:11 12:20 14:47 17:18 18:48.
  await pinDate(page, "2099-02-15T10:00:00Z");
  await completeSetup(page);
  expect(await todayTimes(page)).toEqual({
    Fajr: "05:33",
    Shuruq: "07:10",
    Duhr: "12:19",
    Asr: "14:47",
    Maghrib: "17:19",
    Isha: "18:49",
  });
});
