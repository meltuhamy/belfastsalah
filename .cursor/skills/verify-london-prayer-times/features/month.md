# Month table

The card under the prayer strip on the home screen. It opens on the current London month and lists one row per calendar day.

## Sub-features

- The card subtitle is the month name (`October`, `February`, …).
- `.MonthPrayerTable tbody tr` has one row per day. Each row's cells are day number, then Fajr, Shuruq, Duhr, Asr, Maghrib, Isha.
- While the table is loading it renders 30 empty rows. A loaded row's second cell matches `/^\d{2}:\d{2}$/`.
- Today's row has class `MonthPrayerTable__row--selected`. Its first cell is the London day of the month. No other row has that class.
- The calendar icon on `.HomePage__month-card` opens the month picker (`ion-picker` or `ion-picker-legacy`). Choosing a month is a button named with that month (`March`, exact) and then **Save**.
- February in a non-leap year has 28 rows. The timetable file still contains a 29 February row that duplicates the 28th. The table must follow the calendar, so 29 rows on a non-leap February is a failure.

## How to get to it (user POV)

Finish setup (**Done** on **Set up**). Scroll the home screen. The month card sits under the six times. The current month is already selected. Tap the calendar icon to change month.

## Driving it with Playwright

Complete the today journey first (fresh context, **Done**, `[data-testid=prayer-strip]` visible) so the table has a location.

Wait until the first data row's second cell matches `/^\d{2}:\d{2}$/` before reading anything. The skeleton looks like a table.

End state that proves it works, for the London month the card is showing:

- Row count equals the number of days in that month (28, 29, 30, or 31). Read the count from `Date` in `Europe/London`, not from the length of the JSON file.
- The selected row's day number equals today's London day-of-month, and it is the only selected row.
- That row's six times equal the home strip (`[data-testid=strip-cell]`) for the same day.
- After changing month, the subtitle updates, the row count matches the new month, and the first row's times equal that month's day 1 in `src/prayer_data/london-<year>.json`, formatted in `Europe/London` the same way as [today.md](today.md). Shafi asr.

Read rows with the page, the same way `monthRows` does in `e2e/support/app.ts`: every `td` text in `.MonthPrayerTable tbody tr`.

## Gotchas

- Do not treat 30 skeleton rows as a successful February. Wait for a `HH:MM` cell first. If that cell never arrives, the journey fails; do not assert on the skeleton.
- The 29 February duplicate in non-leap files is a fixture of the data, not a day the table may show. A 29-row February outside a leap year fails the journey.
- The month picker is an Ionic picker, not a `<select>`. The control that opens it is the calendar `ion-icon` inside `.HomePage__month-card`, not the month subtitle.
- "Today" is the London calendar date, including when the machine running the browser is on another zone. This skill's context sets `timezoneId: Europe/London`. A context left on the machine zone can highlight a different row; that is a different journey (the display-zone notice), not a reason to accept either row.
- Belfast's only file is `belfast-2019.json`, and the app serves that year for any date asked. A Belfast month table will not match `london-<year>.json`. Switch location only in the settings journey, and compare Belfast against the 2019 file.
