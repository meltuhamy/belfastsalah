# Prayer times

An Ionic app that displays prayer times from a mosque prayer times table.

## Features

- Prayer times directly from mosque prayer time table
- Realtime countdown to next prayer
- Notifications when it's time to pray!
- Home screen widgets on Android, and home and lock screen widgets on iOS
- Automatically enable night mode during the night
- Clean, simple design. Under 5mb size!

Supported locations:

- Belfast (Belfast Islamic Centre, NIMFA)
- London (London Unified Islamic Time Table)

## Live app

- [Android](https://play.google.com/store/apps/details?id=com.meltuhamy.londonsalah)
- [iOS](https://apps.apple.com/gb/app/london-prayer-times/id993461657)

## Stack

| | |
|---|---|
| Build | Vite 8 |
| UI | Ionic 8, React 19 |
| Routing | react-router 5 (Ionic 8 still pins v5; v6 lands in Ionic 9) |
| Language | TypeScript 7, strict |
| Tests | Vitest, Playwright; Robolectric and XCTest for the widgets |
| Lint | oxlint |
| Native | Capacitor 8 (Android SDK 36, iOS 15+; widgets iOS 17+) |
| Releases | GitHub Actions and fastlane, from merge to both stores |

## Development

Requires Node 24, the version in `.nvmrc` (`nvm use` picks it up).

```bash
npm install
npm run dev        # dev server on http://localhost:3000
```

Other commands:

```bash
npm run build      # typecheck, then build to build/
npm test           # unit tests (vitest)
npm run test:zones # the unit tests in five time zones
npm run test:e2e   # browser tests (Playwright)
npm run lint       # oxlint
npm run sync       # build and copy web assets into the native projects
npm run assets     # regenerate app icons and splash screens from assets/
```

### Running on a device

```bash
npm run sync
npx cap open android    # opens Android Studio
npx cap open ios        # opens Xcode
```

Android builds need JDK 21 and Android SDK 36. iOS builds need Xcode 26 or
newer; Capacitor 8 uses Swift Package Manager, so there is no `pod install`
step. A build made this way reports version `0.0.0-dev`: the real version
comes from the release (below).

## Releases

Every merge to `master` that changes the app is released to testers -
TestFlight, Google Play internal testing, and a pre-release on
[GitHub Releases](https://github.com/meltuhamy/belfastsalah/releases) with the
release notes and the Android builds. Shipping it to users is one click:
edit that release and untick **Set as a pre-release**. The iOS build then goes
to App Store review and the Android build to production.

Versions bump the patch by default. Label a pull request `release:minor` or
`release:major` for more, or `release:skip` to leave it out. The git tags are
the only record of the version; nothing in the repository is bumped by hand.

[RELEASING.md](RELEASING.md) has the whole story: trying a beta, shipping,
what to do when something fails, the one-time store setup, and the store
listing forms.

## CI

Everything runs on GitHub Actions, which is free and unmetered for this repo
because it is public - including the macOS runners used for iOS.

| Workflow | Runs on | Does |
|---|---|---|
| `ci.yml` | every push to a branch; inside `release.yml` on master | lint, typecheck, unit tests in five zones, browser tests, Android and iOS builds with their widget tests, and the workflows linted (actionlint, zizmor) |
| `release.yml` | merge to master, or by hand | CI, then a release to TestFlight, Play internal testing and GitHub; a dry run on pull requests that change the release machinery |
| `promote.yml` | a release made a full release, or by hand | App Store review and Play production |
| `previews.yml` | pull requests, and master | screenshots of the real app and widgets, in a comment on the pull request |
| `android-device-tests.yml` | pull requests, nightly | the widgets on an Android emulator |
| `record-widget-screenshots.yml` | a commit with `[record screenshots]` | new reference images for the widget screenshot tests |

Actions are pinned to commit SHAs, and Dependabot keeps them, the npm packages
and fastlane up to date with a pull request a week each.

## Contributing

You're welcome to modify the project as you wish and contribute back to this project.

- If you spot a bug, please create an issue on GitHub for it
- If you're fixing a bug or adding a feature, please create a PR and I'll be happy to review and merge your changes. Merged changes reach testers straight away, and users once a release is promoted.
- If you're thinking of creating your own app with this app as a base, you're welcome to do so, but that app must also be open source. See the LICENSE file for more information.

### How do I add my own prayer times?

The prayer data lives in `src/prayer_data`, named `LOCATION-YEAR.json` — for
example `london-2024.json`. Those files are the single source of truth for
which years exist: to add a year, drop the file in, and nothing else needs
updating.

London's timetable from 2026 on is the
[London Unified Prayer Timetable](https://londonsalahtimes.com/downloads/),
imported by `scripts/timetables/lupt-to-utc-json.js` — `node
scripts/timetables/lupt-to-utc-json.js 2026 2076` downloads each year's
spreadsheet and converts its UK clock times to the UTC instants the app
stores. The years before that came from mosque CSVs in
`scripts/timetables/data`, through `scripts/timetables/spreadsheet-to-utc-json.js`.

Adding a new location the user can choose takes four edits: a `PrayerLocation`
value named like its files, plus `locationTimeZones` and `locationNames` beside
it in `src/lib/PrayerTimeData.ts`, and an `IonSelectOption` in
`src/components/LocationSelector.tsx` — the one picker shared by the setup and
settings screens.

## Known issues

- `useSettings` has a `useEffect` missing `dispatch` from its dependency
  array. oxlint reports it; fixing it changes render behaviour, so it has
  been left alone deliberately rather than changed blind.
- `src/prayer_data/london.json` is the pre-2022 year-agnostic table and is no
  longer read by anything.
