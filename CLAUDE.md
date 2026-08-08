# Working on this repo

## Always hand back an APK link

After pushing any change that affects the app, wait for the CI run on that
commit to finish and give back a link to the `app-debug.apk` artifact. Do this
without being asked, as the last step of the work.

The link is the artifact URL from the run for the commit that was just pushed:

```
https://github.com/meltuhamy/belfastsalah/actions/runs/<run_id>/artifacts/<artifact_id>
```

Find it with the GitHub MCP tools — `actions_list` with `list_workflow_runs`
for `ci.yml` filtered to the branch, then `list_workflow_run_artifacts` for
that run id. Direct calls to `api.github.com` are blocked in this environment;
only the MCP tools reach GitHub.

Notes:

- Always state the commit SHA the APK was built from, so it is obvious whether
  a build predates a given fix.
- If CI fails, say so and give the failing job rather than a link. Never hand
  back a link from an older green run as though it were current.
- The artifact cannot be attached directly to the conversation: the download
  redirects to `productionresultssa18.blob.core.windows.net`, which the egress
  policy blocks. A link is the only option.
- Downloading requires being signed in to GitHub; artifacts are not public
  even on a public repo.
- Skip this for changes that cannot affect the app, such as edits to README or
  to workflow files that are not part of the build.

## Testing

- `npm test` — vitest, unit tests in `src/`
- `npm run test:e2e` — Playwright, real-browser tests in `e2e/`

Behaviour is covered end-to-end; vitest is for utility functions and data
correctness, not for screens. `e2e/support/app.ts` holds the shared driving
(complete setup, navigate, pick from a select, read the today card or month
table) so specs stay about behaviour.

Two rules make the e2e assertions stable enough to hardcode:

- **Pin the clock** with `pinDate` before the first `goto`. The times on
  screen come from a fixed timetable, so an unpinned test is asserting against
  whatever today happens to be and goes stale overnight. Winter dates are
  easiest — the UK is on GMT, so the times on screen are the timetable's own
  strings and expectations can be read straight out of `src/prayer_data`.
- **Assert against the timetable**, not against what the app currently
  renders. Numbers in the specs were read out of the JSON.

Note `src/prayer_data` carries a 29 February row in every non-leap year,
duplicating the 28th. It is never rendered, because `getMonth` takes its day
count from the calendar rather than from the file — there is a test pinning
that.

Ionic renders form controls into shadow DOM, and jsdom does not realise it.
Anything about whether a tap actually reaches a control belongs in `e2e/`, not
in a vitest test — a jsdom test will happily pass against a control that
cannot be clicked at all. This has bitten the setup screen twice.

The app shows extra controls when the device's clock differs from the
timetable's, so both suites pin a timezone rather than inheriting the machine's:
`playwright.config.ts` sets `timezoneId: "Europe/London"`, and specs about that
behaviour override it with `test.use({ timezoneId })`. On the vitest side,
`npm run test:zones` runs the whole suite under five zones — run it after
touching anything date-related, because a suite that only passes in London is
how the original bug survived.

In this sandbox Playwright's bundled browser version does not match the
preinstalled one, so run e2e with:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e
```

CI installs its own browser and needs no override.

## The once-a-second re-render

`App` dispatches a tick every second for the countdown, so every screen
re-renders that often — and `@ionic/react` re-assigns *every* prop to the
underlying custom element on *every* render, without comparing to the previous
value. Anything with a value that lives on the element between renders will be
clobbered about once a second.

That is why the reminder slider holds its in-flight value in `SettingsList`
state while a drag is in progress: `ionChange` only fires on release, so
without it the knob was being yanked back to the stored value mid-drag. It is
also why `SetupPage` uses a functional state update. Bear it in mind before
adding another control that has to hold state while being interacted with.

## Hidden test notification

Long-pressing the timer icon on the reminder row schedules a notification a
few seconds out, so the reminder path can be checked without waiting for a
prayer time. There is deliberately no visible affordance. `sendTestNotification`
in `src/lib/notifications.ts` uses id 9999, clear of the prayer reminders,
which use 0-64.

## Theming

One setting, `theme`, with four values: `system` (default), `light`, `dark`,
`maghrib`. `src/lib/theme.ts` decides; `useTheme` in `App.tsx` is the only
thing that touches the palette class, and it puts Ionic's `.ion-palette-dark`
on `<html>`.

`theme/variables.css` holds the app's own colours, which are *not* Ionic 8's
defaults, and it must be imported **before** `palettes/dark.class.css`. Both
land on `<html>` with equal specificity, so source order decides the winner;
the other way round leaves the light palette in force in dark mode, which
looks fine until you notice the striped rows in the month table are white.

Setup keeps its answers local until Done, so it reports the theme up to
`App` via `onThemePreview` — otherwise the picker looks dead on that screen.

## Prayer data

`src/lib/PrayerTimeData.ts` holds `prayerDataLoaders`, the single source of
truth for which years exist. Adding a year means adding a file to
`src/prayer_data/` and one line to that map, nothing else. It used to be a
hardcoded list that silently fell out of step with the files, which meant
London users were served the 2024 timetable throughout 2025 and 2026.
