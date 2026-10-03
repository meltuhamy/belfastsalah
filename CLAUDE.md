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

## Widget tests (Android)

The home screen widgets are native (Kotlin, in `android/app/src/main/java/.../widget`)
and have three layers of tests of their own. None of them run in this sandbox —
Gradle cannot reach Google's Maven here — so CI is the only place they run.

1. **JVM, every push** (`android/app/src/test`, the Android job in `ci.yml`).
   Robolectric with native graphics renders each widget the way a launcher
   does: `WidgetRenderer`'s RemoteViews, applied into real Views.
   - `WidgetRenderTest` — what each widget shows: the highlight, the countdown
     in each mode, city and date, the tile's text sizes, the no-times state.
   - `WidgetFitTest` — no text is cut off, at every size in
     `WidgetHarness.SIZES`, measured from real text layout. This is the check
     that matters most: clipping is the bug these widgets have actually had,
     and it never shows as an error. It found the one-column widget losing
     its Isha row on its first run.
   - `WidgetScreenshotTest` — Roborazzi images compared against the
     references in `android/app/src/test/screenshots`.
2. **Emulator, pull requests and nightly** (`android/app/src/androidTest`,
   `android-device-tests.yml`). `HostedWidgetTest` is its own widget host,
   granted binding with `appwidget grantbind`: the system accepts all five
   widgets, binding runs the provider, a resize reaches
   `onAppWidgetOptionsChanged`, and saving the appearance screen redraws the
   widget. `LauncherPinTest` then has the emulator's launcher add the tile
   through its own dialog; it drives another app's UI, so it retries and a
   failure is only a warning.
3. `PayloadFixture` and `TextFit` in `android/app/src/sharedTest` are shared by
   both.

Things that will bite:

- **The renderer takes `nowMillis`.** Tests pin it; the app passes nothing and
  gets the real clock. The fixture's moments sit half a second before the
  minute, because Chronometer truncates and reads the clock when drawn — aim
  at the second exactly and the text, and every screenshot, flickers between
  runs.
- **The fixture is 15 January, not February.** The layouts carry February's
  times as sample text for the widget picker, so a test on that date can pass
  on placeholders the renderer never touched. The device tests likewise wait
  for text that is not in any layout before believing a widget was drawn.
- **Changing how a widget looks means new reference screenshots.** Push with
  `[record screenshots]` in the commit message (or run
  `record-widget-screenshots.yml` by hand): it re-records them on the CI
  runner and commits them back, and that commit's images are the review of
  the change. They have to come from the runner — another machine draws
  different pixels. CI skips the comparison on the commit that asks for it.
- **The emulator job builds `:app` only.** The root project's test APKs
  include Capacitor's own modules, and the Cordova plugins module does not
  assemble.

## iOS widgets

The iOS widgets follow the Android design: TypeScript decides everything
(`src/lib/widgetPayload.ts`), and the native side shows it. They are SwiftUI,
in a WidgetKit extension, `ios/App/PrayerWidgets`, which needs iOS 17; the app
itself still runs on 15.

- **Two widgets.** "Prayer times" for the home screen (small, medium, large)
  and "Next prayer" for the lock screen (rectangular, circular, inline).
  Their settings are App Intents (`PrayerWidgetIntents.swift`), which iOS
  shows as Edit Widget and stores per placed widget; each intent only builds
  a `WidgetSettings`. The app cannot open that sheet itself, so its settings
  screen shows a tip there instead of Android's "Widget appearance" row
  (`widgetSettingsRoute`).
- **The payload crosses an App Group**, `group.com.meltuhamy.londonsalah`
  (`ios/App/Shared/WidgetStore.swift`). `PrayerWidgetPlugin.swift` has the same
  JS name and `update` method as the Kotlin plugin, and `MainViewController`
  registers it - plugins inside the app are not in Capacitor's generated list.
  A simulator only grants entitlements to a signed app, so every simulator
  build that has to share data is signed ad hoc
  (`CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM=`), never
  `CODE_SIGNING_ALLOWED=NO`.
- **No alarms.** WidgetKit draws a timeline of entries, one per prayer, from
  `PrayerTimeline`; the system ticks `Text(_, style: .timer)` in between.
  The minutes countdown has no live text style, so in that mode there is an
  entry a minute, capped per timeline.
- **The views take the family and colour scheme as parameters**
  (`PrayerWidgetContent`). Outside WidgetKit neither can be set through the
  environment, so a view that read them could only be tested one way.

Tests are `ios/App/PrayerWidgetsTests`, run on a simulator in ci.yml, and
like Android's they cannot run in this sandbox:

- `WidgetPayloadTests` and `PrayerTimelineTests` read
  `fixtures/widget-payload/*.json`, which `src/lib/widgetPayload.fixture.test.ts`
  writes with the real `buildWidgetPayload` and fails on when they are out of
  date (`UPDATE_FIXTURES=1 npx vitest run widgetPayload.fixture`). A change to
  the payload therefore reaches the Swift tests as a changed file. CI runs
  them in three more zones.
- `AppGroupTests` runs inside the app and checks it is entitled to the group.
- `WidgetFitTests` is `WidgetFitTest`'s counterpart: `fitProbe` records each
  text's given and natural width, at the Pro Max and SE sizes.
- `WidgetSnapshotTests` compares against `__Snapshots__`, recorded on the
  runner by `[record screenshots]` exactly as on Android. The countdown is
  rebased onto the real clock before drawing (`rebasedToNow`), half a second
  short of the minute, for the same reason as the Android fixture.
- Everything uses 15 January; `PrayerEntry.sample` - the gallery and
  placeholder - uses 15 February.

The targets were added by `scripts/ios/add-widget-targets.rb`.

## Preview comments

`previews.yml` puts the real app, and its widgets, on an iOS simulator and an
Android emulator, screenshots them, and keeps one comment on each pull request
up to date with the results, in collapsed `<details>` sections. It is for
reviewers, not a test: it never fails the build, and a capture that does not
work just drops its image, which the comment lists as missing.

- The drivers are `ios/App/PreviewCapture/PreviewCapture.swift` (an XCUITest
  target with its own scheme, so App's builds never include it) and
  `android/app/src/androidTest/.../preview/PreviewCapture.kt` (no size
  annotation, so the device tests' size-filtered runs skip it). Both name each
  capture; `scripts/previews/catalogue.mjs` says which names the comment shows,
  under which heading. Adding a screen means a capture in the driver and a line
  in the catalogue.
- Settings are planted rather than tapped through: launch arguments into
  UserDefaults' argument domain on iOS, the `CapacitorStorage`
  SharedPreferences file on Android. Both are where `@capacitor/preferences`
  reads, under the key `settings`.
- The clock is not pinned - neither platform allows it - so the times on screen
  are whenever CI ran. The status bars are pinned to 9:41.
- Images go to the `previews` branch (`scripts/previews/branch.sh`), never to
  the branch under review: `pr-<n>/<commit>/` per pull request and `master/` at
  full size, which is App Store sized (an iPhone Pro Max simulator). The branch
  is rewritten as a single commit on every change. Do not merge it or build on
  it.
- The PreviewCapture target was added by `scripts/ios/add-preview-capture-target.rb`;
  rerunning it is a no-op.
- Pull requests from forks are captured but not published - their token is
  read-only.

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

## The card that points at the next prayer

`PrayerDayCard` is the blue countdown card, and below it the strip of the
day's six times on the page background. The card has a tail that points at
whichever column is next.

The tail is placed by arithmetic, not by measuring: `--next-column` is the
`Prayer` enum value of the next prayer — the enum is ordered as the strip is,
so it *is* the column index — and the tail sits at
`(column + 0.5) × (100% / 6)` of the card's width. That only lands on a column
centre because the card and the strip are the same width and the strip's grid
spans all of it. The wrapper owns the margins and the `IonCard` inside it has
none, so that is true by construction rather than by two elements agreeing;
keep it that way, and keep horizontal padding out of the strip itself (it goes
inside the cells instead).

Two Ionic details cost an afternoon each, and both are undone in
`PrayerDayCard.css`:

- **`ion-card` sets `contain: content` as well as `overflow: hidden`.** Paint
  containment clips to the border box by itself, whatever `overflow` says, so
  overriding only `overflow` leaves the tail invisible with nothing in the DOM
  to show for it. `e2e/support/app.ts`'s `tailTarget` asks the page what is
  actually painted in the gap below the card, via `elementFromPoint`, because
  a clipped tail keeps its box and its position — a geometry assertion passes
  straight through this bug.
- **`ion-card` is a shadow host**, so `::before`/`::after` on it are never
  rendered; its box children come from the shadow tree. The tail is a real
  `<span>`.

Text inside a card needs its class doubled up (`.PrayerDayCard .X`): Ionic
styles it as `.card-content-md p`, which outweighs a single class of ours and
flattens every line to the same size.

After the last prayer of the day the strip shows *tomorrow's* times, since
that is what the card is counting down to — `usePrayerStrip`. The "Tomorrow"
badge is a separate question from that, and is asked in the display zone
(`isLaterDay`): someone in Dubai reading London times at 23:30 London is
already on that day themselves, so the badge would be a lie.

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

The files in `src/prayer_data/` are the single source of truth for which
years exist: `PrayerTimeData.ts` builds `prayerDataLoaders` from every
`<location>-<year>.json` there, so adding a year means adding its file and
nothing else. It used to be a hardcoded list that silently fell out of step
with the files, which meant London users were served the 2024 timetable
throughout 2025 and 2026.

The London files are generated, so regenerate rather than editing them by
hand:

- **2026 to 2076** come from the official London Unified Prayer Timetable,
  `node scripts/lupt-to-utc-json.js 2026 2076`, which downloads each year's
  .xlsx from londonsalahtimes.com/downloads into `scripts/data/lupt` (not
  committed). Those sheets change their clocks on the real dates, and the
  script refuses one that does not. The 2026 file only has a 12-hour sheet,
  which the script turns back into 24-hour times.
- **2022 to 2025** come from the CSVs in `scripts/data`, through
  `scripts/spreadsheet-to-utc-json.js`. 2025's sheet moves its clocks on
  1 April and 28 October, not on the real dates, so that script converts each
  row with the offset the sheet itself is using, read off its own hour jumps.
  Converting with the calendar's offset left days each spring and autumn an
  hour out.

Every number the tests pin is read out of these files, so a re-import moves
them; 2026's official times differ from the old ones by a minute on most
days.
`prayerDataFiles.test.ts` fails on any day-to-day jump of more than half an
hour in any file, and `e2e/clock-change.spec.ts` checks the two 2026 changes
on screen.
