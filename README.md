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
step. A build made this way reports version `0.0.0-dev`; only releases carry
a real version.

## Releasing

Merging to `master` releases the app to testers: TestFlight, Google Play
internal testing, and a pre-release on
[GitHub Releases](https://github.com/meltuhamy/belfastsalah/releases). To ship
it to users, edit that release and untick **Set as a pre-release**.

Each merge bumps the patch version. Label the pull request `release:minor` or
`release:major` for a bigger bump, or `release:skip` to hold it back. Never
bump a version or create a tag by hand.

[RELEASING.md](RELEASING.md) has the steps, and what to do when one fails.

## Contributing

You're welcome to modify the project as you wish and contribute back to this project.

- If you spot a bug, please create an issue on GitHub for it
- If you're fixing a bug or adding a feature, please create a PR and I'll be happy to review and merge your changes. Merged changes reach testers straight away, and users once the release is shipped.
- If you're thinking of creating your own app with this app as a base, you're welcome to do so, but that app must also be open source. See the LICENSE file for more information.

### Pull requests

CI runs on every push: lint, typecheck, unit and browser tests, and the
Android and iOS builds with their widget tests. A pull request also gets a
comment with screenshots of the app and its widgets on an iPhone and an
Android phone, and its widgets are tested on an Android emulator.

If you change how a widget looks, put `[record screenshots]` in the commit
message. CI then records new reference screenshots and commits them to your
branch.

### How do I add my own prayer times?

- **A year**: add `src/prayer_data/LOCATION-YEAR.json`, for example
  `belfast-2027.json`. Nothing else needs updating: those files are the only
  list of which years exist.
- **London's timetable**: run
  `node scripts/timetables/lupt-to-utc-json.js 2026 2076`. It downloads the
  official [London Unified Prayer Timetable](https://londonsalahtimes.com/downloads/)
  for those years and writes their files, with the UK clock times converted
  to the UTC instants the app stores.
- **A location**: add a `PrayerLocation` value named like its files, with
  `locationTimeZones` and `locationNames` beside it in
  `src/lib/PrayerTimeData.ts`, and an `IonSelectOption` in
  `src/components/LocationSelector.tsx`, the picker shared by the setup and
  settings screens.

## Known issues

- `useSettings` has a `useEffect` missing `dispatch` from its dependency
  array. oxlint reports it; fixing it changes render behaviour, so it has
  been left alone deliberately rather than changed blind.
- `src/prayer_data/london.json` is the pre-2022 year-agnostic table and is no
  longer read by anything.
