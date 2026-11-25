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
- On master, CI runs inside `release.yml` rather than as `ci.yml` of its own.
  A merged change's signed builds are on its GitHub release.

## Releases

A merge to `master` that changes the app is released to testers by itself,
and to users when its GitHub pre-release is made a full release. RELEASING.md
has the steps. When working on the code:

- **Merging is shipping to testers**, so a pull request has to be finished
  when it merges.
- **Never write a version into a file**, and never create a tag or a release
  by hand. The `vX.Y.Z` tags are the only record: fastlane passes the version
  to Gradle (`-PversionCode`, `-PversionName`) and to xcodebuild
  (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`), and the files say
  `0.0.0-dev` / `0.0.0` on purpose. Each run counts on from the highest `v*`
  tag.
- **Label the pull request** when a patch is wrong: `release:minor`,
  `release:major`, or `release:skip`. A release takes the biggest bump of all
  the pull requests in it. Docs, tests, CI and tooling are not released on
  their own - `isAppFile` in `scripts/release/version.mjs` - so they need no
  label.
- **A new build tool goes in `BUILD_DEV_DEPENDENCIES`** (`version.mjs`). An
  npm change counts as the app only if it reaches what the app ships or is
  built with, worked out from the lockfile, and Vite, its React plugin and
  Capacitor's CLI and platforms are devDependencies here. A Vite plugin or
  other build step left off that list would have its updates go unreleased.
- **Leave the build number alone**: major x 1,000,000 + minor x 1,000 +
  patch, the same on both stores. `version.test.mjs` pins why.
- **Check the dry run** on a pull request that changes the release
  machinery: `fastlane/`, `scripts/release/`, `release.yml`, the native build
  files. It builds signed apps carrying the next version, has Google Play
  and Apple validate them as they would an upload (Apple's findings from
  processing a build come by email, only after a real one), and releases
  nothing. Dependabot's pull requests get none, having no secrets. Try a
  change to `promote.yml` by running it from the branch with `dry_run`.
- **Promotion always runs from master.** `promote-on-release.yml` hands a
  released pre-release to `promote.yml` on master, so a fix to the promote
  lanes reaches releases made before it, and a dry run tries the same code.
  Only the newest release can ship, Google Play first. A release is a full
  release only once a store has it - the hand-over makes it a pre-release
  again while Promote runs - because `plan.mjs` drafts What's new from the
  last full release.
- **Change the release notes' format only in `scripts/release/notes.mjs`**:
  promotion reads "What's new" back from between its markers, and
  `notes.test.mjs` pins them.
- **Keep every store step idempotent** - ask the store first - so a failed job
  is fixed by re-running it.
- **Workflow conventions**: actions pinned to commit SHAs with the version in
  a comment, which Dependabot updates, and actionlint and zizmor pinned by
  image digest, which it does not; local actions as `uses: ./.github/...`
  (zizmor's self-repository audit, which wants `$/`, is off in
  `.github/zizmor.yml`); `permissions:` and `timeout-minutes` on every job;
  the Google Play values are secrets. CI's Workflows job runs actionlint and
  zizmor, so run both before pushing a workflow change.

## Testing

- `npm test` — vitest, unit tests in `src/`, and in `scripts/` for the release
  and preview tooling
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
CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npm run test:e2e
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
  `SceneDelegate` is what creates that controller; the storyboard is not used.
  It once created Capacitor's own instead, so the plugin was never registered,
  the web layer's calls failed quietly, and every placed widget said "No
  times" - only the preview's real home screen showed it. `AppGroupTests`
  pins it now. The plugin and the extension log `PrayerWidget:` lines, and
  Debug builds print why a widget is empty under "No times".
  A simulator only grants entitlements to a signed app, so every simulator
  build that has to share data is signed ad hoc - `xcodebuild -xcconfig
  AdHocSigning.xcconfig`, from `ios/App` - never `CODE_SIGNING_ALLOWED=NO`.
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

That is why the reminder slider holds its in-flight value in
`PrayerReminderEditor` state while a drag is in progress: `ionChange` only fires on release, so
without it the knob was being yanked back to the stored value mid-drag. It is
also why `SetupPage` uses a functional state update. Bear it in mind before
adding another control that has to hold state while being interacted with.

## The day card

`PrayerDayCard` is one card, laid out like the home screen widget: the
countdown and where and when across the top, the day's six times along the
bottom with the next one on a frosted pane, and open sky in between. It is tall
on purpose - in the Sky theme the sun travels that space and the stars fill it.
The Sky theme's colours, sun position and highlight panes (`--sky-glass`) all
come from `skyProperties` in `src/lib/sky.ts`; the card squeezes the sun's arc
into the open band so it never sits on the countdown, while the widgets draw
sky.ts's arc as it is. The stars are `StarField`: a new random scatter
(`src/lib/starfield.ts`) every time the card mounts, painted once into a canvas
and turned slowly about the middle of the card's top edge - made on mount, not
on render, or the once-a-second tick would reshuffle them. They sit at three
depths, each its own layer; tipping the phone (`tilt.ts`) moves each layer by a
different amount (`STAR_LAYERS`), written onto the elements and eased a
frame at a time by `createTiltEaser`, with a top speed - not by a CSS
transition, which every reading restarted at full speed. The tilt is measured
on which way is up (`upFor`), never on `beta`/`gamma` directly: those Euler
angles flip by up to 180 degrees as a phone passes upright, which threw the
stars across the card now and then (MEL-352). Springs, with overshoot, were
tried and taken out: plain easing felt better.
By day there is a faint lens flare (`LensFlare`): ghosts on the line from the
sun through the card's middle, which the tilt shifts a little, so the line drifts about
the sun. It fades with `--sky-sun-on`. The stars and the flare share one tilt
listener's logic, `useTilt`, which also asks iOS for the readings.

The card's sun is strictly from Shuruq (`--sky-sun-on`, rising in over three
minutes) to ten minutes after Maghrib, though sky.ts's arc - which the widgets
draw as it is - has it up 45 minutes either side. Before Shuruq the card shows
first light instead: a warm glow on the horizon at the left, where the sun
will come up (`--sky-dawn`, `PrayerDayCard__dawn`).

Fajr has a moment of its own on the Sky card, the white thread of dawn in a
haze (`fajrThread` in sky.ts, designed in the "Fajr moments" canvas): a soft
band of pale light gathers on the horizon over the hour before Fajr, with a
soft line of light inside it for the last 25 minutes. As Fajr comes in the
line brightens once (`PrayerDayCard__fajr-line--arriving`, keyed on Fajr's
adhan moment), then breathes; between Fajr and Shuruq the light warms to
peach, drifts left and hands over to the dawn glow, and by Shuruq it has
gone. sky.ts writes whole `radial-gradient`s (`--sky-fajr-haze-bg`,
`--sky-fajr-line-bg`) since old iOS cannot mix colours in CSS. The line is a
blurred glow a few px tall, never a 1px stroke, which read as a cut across
the card. Card only for now: the widgets do not draw it.

Two Ionic details to know, both handled in `PrayerDayCard.css`:

- **`ion-card` is a shadow host**, so `::before`/`::after` on it are never
  rendered; the sun and stars are real `<span>`s in a layer of their own.
- **Text inside a card needs its class doubled up** (`.PrayerDayCard .X`):
  Ionic styles it as `.card-content-md p`, which outweighs a single class of
  ours and flattens every line to the same size.

For five minutes after a prayer comes in its adhan is being called, and the
card says "It's time for Asr" with the adhan icon calling, then "Maghrib is
in …"; Asr stays highlighted, and the strip
stays on that prayer's day. `src/lib/adhanMoment.ts` decides, never for
Shuruq. It also covers the moment after a prayer's time when `next` is still
that prayer, before the app has fetched the one after - the card used to go
blank there - and a prayer's exact second, which the `prev`/`next` lookups
count as neither. The highlight is one pane behind the cells that glides from
column to column, and each new headline rises in as the old one drifts out
(`HeadlineSlot`); the outgoing copy has its test ids stripped. The countdown
rounds its seconds up, as a countdown does: rounded down, the last
part-second was "0s", which prints nothing, and the card said only "Fajr in"
(MEL-351).

`e2e/support/app.ts`'s `paintedHighlight` asks the page what is actually drawn
at the highlighted cell, via `elementFromPoint`, so a cell clipped by the
card's corners does not pass on its box alone.

After the last prayer of the day the strip shows *tomorrow's* times, since
that is what the card is counting down to — `usePrayerStrip`. The "Tomorrow"
badge is a separate question from that, and is asked in the display zone
(`isLaterDay`): someone in Dubai reading London times at 23:30 London is
already on that day themselves, so the badge would be a lie.

## Hidden test notification

Long-pressing the alarm icon on the Prayer Notifications row schedules a
notification a few seconds out, so the reminder path can be checked without waiting for a
prayer time. There is deliberately no visible affordance. `sendTestNotification`
in `src/lib/notifications.ts` uses id 9999, clear of the prayer reminders,
which use ids 0 up to `notificationLimit` in `src/lib/reminderSchedule.ts`
(181 on Android, 64 elsewhere). The test day's notifications use 9900 up;
a reschedule leaves every id from 9900 alone.

## Prayer reminders

Settings has one switch, Prayer Notifications (`notify`), and under it a
Notification Settings row (the adhan icon, `AdhanIcon`) that opens
`/settings/notifications`. From there each prayer has its own screen
(`/settings/notifications/prayer/<key>`, or `all` for every prayer at once)
and there is the test day (`/settings/notifications/test`).

- **`settings.reminders`** holds, per prayer, `{ on, offset, sound }`:
  `src/lib/prayerReminders.ts`. `offset` is minutes from the prayer, -30 to
  +30, so a reminder can come after its prayer. New installs get 5 minutes
  before on every prayer with the default sound. `migrateReminders` turns the
  old single `notifyMinutes` (and the first version's `notifySound` /
  `fajrSound`) into the same values on every prayer, so an upgrade changes
  nothing.
- **Both schedulers read it.** `buildReminderPayload` (Android) and
  `planReminders` (iOS) skip a prayer that is off, and decide by the
  reminder's time, not the prayer's - a reminder after a prayer that has just
  passed is still ahead. Both sort by time, since offsets can cross. The
  body is `reminderBody(offset)`: "In 10 minutes", "Prayer time now",
  "10 minutes ago".
- **Android never posts a reminder early, or twice.** A Xiaomi delivered
  exact alarms a minute or two early, and a reminder posted early was still
  ahead of the clock, so the next replan armed it again and it came a second
  time. A broadcast more than `EARLY_TOLERANCE_MILLIS` (5s) early is not
  posted and the reminder is armed again for its time; `PostedReminders`
  remembers the last few posted so a re-armed one is skipped
  (`ReminderAlarmsTest`).
- **`PrayerReminderEditor`** is the one editor, used on a prayer's screen and
  in the test day's sheet: switch, slider, and a sound list where tapping a
  row chooses it and only its speaker button plays it (`soundPreview.ts`).
  The slider's bubble says "+5" or "−5", since words do not fit in it, and
  the times line under it is a function of the offset so it follows a drag.
  A prayer's screen also has "Apply to all prayers", which copies its
  on/off, timing and sound to the other five after a confirmation.
  `onChange` gets only the field that was touched, never a whole reminder.
  That matters on "All prayers" (`remindersForAll`): a field the prayers
  differ on is passed in `mixed` and shows nothing chosen, so any choice
  there is written to all six, Fajr's own value included. Diffing a whole
  reminder against Fajr's used to drop exactly those choices.
- **The default sound** has no file, so the page cannot play it. The apps
  can: `PrayerReminders.playDefaultSound` plays Android's notification sound,
  and on iOS (`PrayerRemindersPlugin.swift`, the plugin's only methods there)
  the standard tone, since iOS will not play the user's chosen one. The web
  shows no speaker for it (`canPreview`). The Swift file was added to the
  target by `scripts/ios/add-reminders-plugin.rb`.
- **The test day** (`TestRemindersPage`, maths in `testDay.ts`) plays today's
  prayers in about 30 seconds on a timeline that is not to scale: six equal
  slots, the half hour either side of each prayer spread across most of its
  slot. Dragging, tapping or the arrow keys snap to a prayer, stopping 31
  minutes before it so all its reminders are still ahead. At a reminder it
  posts a real notification (`showPreviewNotification`; on the web it plays
  the sound in the page instead) and waits `SOUND_SECONDS` for the sound to
  end, since the app cannot hear when it does. Only the web, which has no
  notifications, shows a drawn stand-in (`test-day-banner`); on a phone a
  second banner would sit beside the real one. On Android it posts on the
  prayer's own channel, so it pops up or not exactly as that prayer's
  reminders will. The notification is posted at once, not scheduled
  (a schedule goes through Android's alarm manager and arrived after the
  day had stopped), permission and channels are readied when play is
  pressed (`preparePreviewNotifications`), and the wait is timed from when
  the post completes. Each one is removed from the notification centre when
  its wait ends, and all of them on leaving the screen; one still being
  posted then is taken down when it arrives. `tick` runs in the first
  render's closure, so it reads everything, today's times included, from
  `latest`. It times itself with `performance.now()`, so e2e specs that pin
  `Date` still play.

### Reminder sounds

- **The adhans are numbered, never named**, in the picker. Each is the opening takbir of a longer recording, cut to 30
  seconds or less, which is iOS's limit for a notification sound.
- **Each one ships three times**: `public/sounds/adhan-N.mp3` (played in the
  app), `android/app/src/main/res/raw/adhan_N.ogg` and
  `ios/App/App/Sounds/adhan-N.caf`. `reminderSound.test.ts` fails if one is
  missing. Adding one means all three files, a line in `REMINDER_SOUNDS` and
  `SOUND_SECONDS`, `ReminderSounds.ADHAN_COUNT`, and
  `ruby scripts/ios/add-reminder-sounds.rb`.
- **Android: one channel per prayer** (`ReminderChannels.kt`), named Fajr to
  Isha, so how each prayer appears - pop-up, vibration, lock screen - is the
  user's choice in Android's settings. The app does not model it: each
  prayer's screen has an Appearance row (`ReminderAppearanceRow`) that reads
  the channel's importance back and opens its settings page, and refreshes on
  resume. A channel's sound cannot change once it exists, so a prayer whose
  sound changes gets a new channel under a fresh id (`prayer-<key>-<n>`),
  created with the old one's settings, and the old one is deleted; which id
  is current, and its sound, is in the `reminder_channels` SharedPreferences.
  - **Reminders are banners by default** (`DEFAULT_IMPORTANCE`, high). A new
    install starts there. The first time on an upgrade, each prayer's channel
    is copied from the per-sound channel it used before (`default`, `silent`,
    `adhan-N`); one still at the level the app gave it (default, or low for
    silent) is raised to a banner, and anything the user set themselves is
    kept. Android cannot say which a level is, so the old default counts as
    unchosen. Then the per-sound channels are deleted, except `default`,
    which carries the "reminders stop here" prompt, the hidden test
    notification, and any reminder armed by an older version.
  - The payload carries `prayer` on each entry and `channels` (every
    prayer's sound, including ones that are off). `sound` is still there,
    only when not the default, for Android 7, which has no channels.
  - **Android 7 reads `sound` as a raw resource name**, `adhan_N` with an
    underscore (`androidSoundName`). iOS's `adhan-N.caf` finds nothing there,
    and the plugin quietly falls back to the default sound, so anything
    posted from JS picks the name by platform (`notificationSoundName`).
  - Every sync, and `PrayerReminders.ensureChannels({ sounds })` (the
    Appearance row, and the test day before each notification), brings the
    channels up to the current sounds.
  - `ReminderChannelsTest` pins the copying, the migration and the deletion.
- **iOS: the sound is a file name** at the root of the app bundle. Leaving
  `sound` out is silence, which is how every iOS reminder used to arrive;
  `"default"`, a name with no file, is the system sound.

## Theming

One setting, `theme`, with four values: `system`, `light`, `dark`, `sky`.
`sky` is a new install's default (`getDefaultSettings`); settings saved
without a theme migrate to `system`, which was the default when they were
written, so an upgrade does not change the look. There used to be a `maghrib`
("Dark after Maghrib"); Sky goes dark at Maghrib too, and `migrateSettings`
moves it there. `src/lib/theme.ts` decides; `useTheme` in `App.tsx` is the only
thing that touches the palette class, and it puts Ionic's `.ion-palette-dark`
on `<html>`.

`theme/variables.css` holds the app's own colours, which are *not* Ionic 8's
defaults, and it must be imported **before** `palettes/dark.class.css`. Both
land on `<html>` with equal specificity, so source order decides the winner;
the other way round leaves the light palette in force in dark mode, which
looks fine until you notice the striped rows in the month table are white.

Setup keeps its answers local until Done, so it reports the theme up to
`App` via `onThemePreview` — otherwise the picker looks dead on that screen.

### Sky

The Sky theme paints the countdown card as the sky for the moment, and tints
the rest of the app from it. `src/lib/sky.ts` decides everything and is pure:
ten colour points built from the day's own prayer times (the six prayers, plus
Fajr − 60, Shuruq + 90, Maghrib − 25 and Isha + 90), blended in OKLab. The
widgets will draw the same sky from it (MEL-336), so colours belong there and
nowhere else.

- **`useTheme` applies it**, as custom properties on `<html>` plus the
  `sky-theme` class, and only when the minute changes - not on the
  once-a-second tick. `theme/sky.css` re-points Ionic's palette at them and
  is imported after `dark.class.css`, at the same specificity as its most
  specific rule. Tints are computed in TypeScript because the oldest iOS the
  app runs on has no `color-mix()`.
- **Dark follows `maghrib`'s rule.** The tint changes all day, but the
  palette only flips at Maghrib and Shuruq, so the page's text colour is
  never caught between the two.
- **Text on the card is black or white, at full strength.** Any colour reads
  at 4.58:1 or better against one of the two. Where the sky turns from dark to
  light, a straight blend leaves the top of the card dark while its middle is
  already light, and no text colour reads against both. So `blend` bends the
  middle and horizon to cross over at the instant the top does. `sky.test.ts`
  checks every five minutes of a year, and every minute of the clock-change
  days. Do not fade the card's secondary lines in this theme: the contrast
  only holds at full opacity.
- **Setup has no times yet**, so `useTheme` stands London's day in for the
  preview.
- **The day bar runs midnight to midnight in the timetable's zone**
  (`timetableZoneFor`), so Istanbul's day starts at Istanbul's midnight.
- The sun and stars are a decorative layer inside the card, clipped on its
  own: the card itself keeps `overflow`/`contain` undone for the tail.

### Sky widgets

The widgets have a Sky palette too, drawn from the same module. The sky
changes all day but the payload is only written when the app runs, so this is
the one calculation the native side does itself:

- **The payload carries the inputs, not the answers**: each day's ten point
  times (`WidgetDay.sky`) and the ten points' colours (`skyColours`).
  `WidgetSky.kt` and the `WidgetSky` enum in `WidgetPayload.swift` are
  line-by-line ports of `skyAtTimes`/`skyAtDays`. A change to the blend in
  `sky.ts` has to be made in both.
- **`fixtures/widget-payload/sky-london-2026-01-15.json` holds them to it**:
  TypeScript writes over 500 samples of its own answer (every ten minutes for
  two days, every minute through dawn and into sunset), and `WidgetSkyTest`
  and `SkyTests` check the ports against them, a channel's rounding apart.
  Regenerate with `UPDATE_FIXTURES=1 npx vitest run widgetPayload.fixture`.
- **Android draws the sky as a bitmap** (`SkyPainter`) into an ImageView,
  `sky_background`, which every widget layout now has behind its content in
  a FrameLayout - RemoteViews cannot set a gradient at runtime. The picture
  is kept under about 470KB: a RemoteViews crosses processes in one binder
  transaction, which fails above about 1MB.
- **Android redraws a Sky widget every quarter hour** with a plain RTC
  alarm (`WidgetAlarms.scheduleSkyTick`), which does not wake the phone:
  while the screen is off it waits, so the sky costs nothing until someone
  could see it. The prayer boundary's exact alarm is separate and unchanged.
- **iOS gives a Sky timeline an entry every quarter hour**, each with its
  own `PrayerEntry.sky`. Sixty entries is about fifteen hours.
- On the sky, text is black or white at full strength and the next prayer's
  highlight is frosted glass, whatever highlight colour was chosen.

## Prayer data

The files in `src/prayer_data/` are the single source of truth for which
years exist: `PrayerTimeData.ts` builds `prayerDataLoaders` from every
`<location>-<year>.json` there, so adding a year means adding its file and
nothing else. It used to be a hardcoded list that silently fell out of step
with the files, which meant London users were served the 2024 timetable
throughout 2025 and 2026.

London after 2026 has no files: `src/lib/londonCalculation.ts` calculates
it on the device with adhan-js's `CalculationMethod.LondonUnified()` at
Charing Cross, which reproduces the London Unified Prayer Timetable
([technical page](https://londonsalahtimes.com/technical/)) to the minute.
`getPrayerData` calculates any London year past the last file, so years
after 2076 work too.

- `londonCalculation.test.ts` pins the calculation to a hash of the 2027 to
  2076 files as they were at 03f7f53, the last commit that had them: all seven
  times, every day. It is what proves an adhan-js upgrade still matches.
- `node scripts/timetables/compare-london.mjs [from] [to]` is the loop for
  working on it: in about a second it diffs the calculation against those
  files (read back from git) and prints how many days each time differs on,
  with the first few. Run it after any change to the calculation.
- Do not re-import 2027 onwards with `lupt-to-utc-json.js`: a file for a year
  takes over from the calculation for that year.

### Istanbul

Istanbul has no files at all: `src/lib/istanbulCalculation.ts` calculates
every year with adhanfork's `CalculationMethod.Diyanet()` at 41.014, 28.972,
the reference point fitted to Diyanet's table (Turkey's Presidency of
Religious Affairs, namazvakitleri.diyanet.gov.tr, district 9541), which is
what Istanbul's mosques follow. `chooseYear` calculates every year for a
location with no files.

- **It is exact for 2026.** The method alone matches 2183 of the year's 2190
  times; the other 7, each within a second of the half minute, are listed in
  adhanfork's `src/Diyanet.ts`. Later years get the method alone (99.6% on
  days it was not fitted on, never more than a minute off) until their table
  is checked.
- **When Diyanet publishes a year** (it shows only the current calendar
  year), save its yearly table as
  `scripts/timetables/data/diyanet-istanbul-<year>.json`, in the 2026 file's
  shape, add it to adhanfork's fixture with any days it rounds the other way,
  release adhanfork, and extend `istanbulCalculation.test.ts`.
- **Times are Istanbul's**, `Europe/Istanbul`, UTC+3 with no clock changes;
  every place that reads the timetable's calendar uses `timetableZoneFor`,
  never `UK_TIME_ZONE`.
- **One Asr.** Diyanet publishes a single Asr, the first (shadow as long as
  the object), so `supportsHanafiAsr` is false and settings has no asr switch,
  as for Belfast. Turkey is Hanafi; settings deliberately says nothing about
  madhab rather than label Diyanet's Asr "Shafi'i".

### The vendored adhan-js: `adhanfork`

The calculation library is `adhanfork`, not the npm `adhan` package. It is
`vendor/adhanfork-<version>-fork.<n>.tgz`, built by the private repo
`meltuhamy/adhanfork` (renamed from `adhan-london`): upstream adhan-js
`develop` plus the London Unified method (`SolarModel.Noon`, per-day
`fajrInterval`/`ishaInterval`, `methodDailyAdjustments`,
`CalculationMethod.LondonUnified()`), Diyanet's method for Istanbul
(`solarPositionHour`, `SolarEphemeris`, `CalculationMethod.Diyanet()`), and
that repo's own build plumbing.

- **Never edit or rebuild the tarball here.** Builds come only from that
  repo's Sync workflow (`london-sync.yml`), which rebases onto upstream, runs
  the tests (including exact published-times fixtures for London and
  Istanbul) and releases the tarball there. The lockfile's `integrity` is the
  release's sha512, so `npm ci` refuses anything else.
- **Dependabot does not see it** - `file:` dependencies are skipped. Updates
  are done by hand, now and then, as below.
- There is only ever one tarball in `vendor/`; history keeps the old ones.
- If upstream adhan-js ever ships both methods, go back to the npm package
  and archive `adhanfork`.

Updating it. The repo is private, so this needs a machine signed in to
GitHub as meltuhamy - from a cloud session, attach the user's Mac, which has
`gh` and a clone at `~/dev/adhan-london` (`LONDON.md` there explains it):

1. `gh workflow run london-sync.yml -R meltuhamy/adhanfork`, then
   `gh run watch` it. It does nothing if upstream `develop` has not moved
   (`-f force=true` rebuilds anyway). If it fails it opens an issue there
   and releases nothing; a rebase conflict is resolved by hand in the clone,
   `london-unified` pushed, and the workflow run again.
2. `gh release download v<version> -R meltuhamy/adhanfork` for the new
   `adhanfork-<version>.tgz`, and get it into this checkout. A cloud session
   cannot download it, but `npm pack` is reproducible: building the same
   commit (`npm ci --ignore-scripts`, `npm run build`, `npm version
   --no-git-tag-version <version>`, `npm pack`) gives the same bytes, so a
   tarball made elsewhere is fine once its sha512 matches the release's
   (`openssl dgst -sha512 -binary <file> | base64`).
3. Here: `git rm vendor/adhanfork-*.tgz`, put the new file in `vendor/`, then
   `npm install --ignore-scripts ./vendor/adhanfork-<version>.tgz`, and check
   the lockfile's `integrity` for `node_modules/adhanfork` is that sha512.
4. `node scripts/timetables/compare-london.mjs` must say 0 for every time,
   then `npm run test:zones` and the e2e suite. `londonCalculation.test.ts`
   and `istanbulCalculation.test.ts` are the checks that matter: they fail on
   any London day from 2027 to 2076, or any Istanbul time of Diyanet's
   tables, that moves.
5. Commit, push, and hand back the APK as usual. It is an app change for
   releases: `vendor/` and the lockfile's `adhanfork` entry both count.

The London files that remain are generated, so regenerate rather than
editing them by hand:

- **2026** comes from the official timetable,
  `node scripts/timetables/lupt-to-utc-json.js 2026 2026`, which downloads the
  .xlsx from londonsalahtimes.com/downloads into
  `scripts/timetables/data/lupt` (not committed). It only has a 12-hour
  sheet, which the script turns back into 24-hour times, and the script
  refuses a sheet that does not change its clocks on the real dates.
- **2022 to 2025** come from the CSVs in `scripts/timetables/data`, through
  `scripts/timetables/spreadsheet-to-utc-json.js`. 2025's sheet moves its
  clocks on 1 April and 28 October, not on the real dates, so that script
  converts each row with the offset the sheet itself is using, read off its
  own hour jumps. Converting with the calendar's offset left days each spring
  and autumn an hour out.

Every number the tests pin is read out of these files, so a re-import moves
them; 2026's official times differ from the old ones by a minute on most
days.
`prayerDataFiles.test.ts` fails on any day-to-day jump of more than half an
hour in any file, and `e2e/clock-change.spec.ts` checks the two 2026 changes
on screen.
