# Today's prayer times

The home screen after setup: a card counting down to the next prayer, and the day's six times underneath it.

`node .cursor/skills/verify-london-prayer-times/drive.mjs today` is this journey. It exits 0 only when the end state below holds.

## Sub-features

- The strip lists Fajr, Shuruq, Duhr, Asr, Maghrib, and Isha, in that order.
- Times are the London Unified timetable for the London calendar date, Shafi asr (the first asr column in `src/prayer_data/london-<year>.json`).
- The card names the next prayer ("Duhr in") and a countdown (`[data-testid=countdown]`). The previous prayer is "was … ago".
- The column being counted down to has `data-next="true"`. The card's tail is the element `.PrayerDayCard__tail`. Whether it is actually painted is `elementFromPoint` under the card, not the element's box (`e2e/support/app.ts` `tailTarget`). `ion-card` paint containment can clip it while the box stays put.
- `[data-testid=day-date]` is the London date of the strip, en-GB, comma removed, for example `Sat 31 Oct`.
- The card names the location (`London`).
- After the last prayer of the day the strip rolls to tomorrow and `[data-testid=tomorrow-badge]` reads `Tomorrow`. That badge is about the display zone, not about the strip itself.

## How to get to it (user POV)

1. Open the app with no saved settings. The title is **Set up**. Location is already London.
2. Press **Done**.
3. The title becomes **Prayer Times**. The blue card and the six times are on the page background under it. The month table is further down.

## Driving it with Playwright

```bash
node .cursor/skills/verify-london-prayer-times/drive.mjs today
```

The script uses a fresh context, so it always starts on setup. It clicks the button named `Done`, waits until `[data-testid=prayer-strip]` is visible and **Done** is gone, waits 700ms (the settings write is debounced by 500ms), reads the strip, and compares it to the row for the London calendar date the page's clock reports.

Columns in the JSON row are month, day, fajr, shuruq, duhr, asr (Shafi), asr (Hanafi), maghrib, isha. Those clock strings are UTC instants. The script formats each one in `Europe/London` the same way `formatTimeInZone` does, and that formatted value is what the strip must show. The strip's Asr is the Shafi column unless settings say otherwise. This journey never turns Hanafi on.

It then reads `localStorage["CapacitorStorage.settings"]`, reloads, and requires the strip to still match and the **Done** button to stay absent.

Screenshots: `evidence/today-setup.png` before the click, `evidence/today-home.png` after the strip is up. `evidence/today.json` is the comparison.

## Gotchas

- Do not assert a hardcoded countdown. The app ticks every second and the figure depends on the real clock. Assert that the countdown matches `/^\d/` and that one strip cell is `data-next="true"`.
- Do not pin the clock for this journey. A frozen clock is how `e2e/home-page.spec.ts` stays stable; it is not what a person sees. Compare against the timetable row for the real London date.
- The JSON strings match the screen only while London is on GMT. During British Summer Time the screen is an hour later. Compare the screen to the London-local formatting of the UTC instant, which is what `drive.mjs today` does. A hand check that diffs the raw JSON against the strip in summer is wrong, and dropping the check to make it pass is also wrong.
- The card and the strip must stay the same width. The tail is placed at `(column + 0.5) × (100% / 6)` of the card. Horizontal padding on the strip itself moves the columns off the tail.
- `[data-testid=tomorrow-badge]` at 23:30 London time is right. The same badge for someone whose device is already on the next calendar day, while still showing London's clock, is wrong. This journey forces `Europe/London`, so that case does not come up. Do not "fix" a missing badge by changing the device zone.
- Belfast is a different timetable. This feature is London, the default after **Done**.
