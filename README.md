# Prayer times

An Ionic app that displays prayer times from a mosque prayer times table.

## Features

- Prayer times directly from mosque prayer time table
- Realtime countdown to next prayer
- Notifications when it's time to pray!
- Automatically enable night mode during the night
- Clean, simple design. Under 5mb size!

Supported locations:

- Belfast (Belfast Islamic Centre, NIMFA)
- London (London Unified Islamic Time Table)

## Live app

- [Android](https://play.google.com/store/apps/details?id=com.meltuhamy.londonsalah)
- [iOS](https://itunes.apple.com/gb/app/london-prayer-times/id993461657)

## Stack

| | |
|---|---|
| Build | Vite 8 |
| UI | Ionic 8, React 19 |
| Routing | react-router 5 (Ionic 8 still pins v5; v6 lands in Ionic 9) |
| Language | TypeScript 7, strict |
| Tests | Vitest |
| Lint | oxlint |
| Native | Capacitor 8 (Android SDK 36, iOS 15+) |

## Development

Requires Node 22+.

```bash
npm install
npm run dev        # dev server on http://localhost:3000
```

Other commands:

```bash
npm run build      # typecheck, then build to build/
npm test           # run the test suite
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
step.

## Cloud builds

Builds run on GitHub Actions, which is free and unmetered for this repo
because it is public — including the macOS runners used for iOS.

| Workflow | Trigger | Produces |
|---|---|---|
| `ci.yml` | push, PR | lint + typecheck + tests + web build, Android debug APK, unsigned iOS compile |
| `release-android.yml` | `v*` tag | signed `.aab` for the Play Console |
| `release-ios.yml` | `v*` tag | signed `.ipa` uploaded to TestFlight |

To cut a release, bump `versionCode`/`versionName` in
`android/app/build.gradle` and `MARKETING_VERSION` in the Xcode project, then
push a tag:

```bash
git tag v4.0.0 && git push origin v4.0.0
```

### Required repository secrets

Nothing below is stored in the repo; the release workflows read them from
GitHub secrets and clean up any files they write.

**Android**

| Secret | How to get it |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 upload-keystore.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | key password |
| `PLAY_SERVICE_ACCOUNT_JSON` | optional, only for automatic Play upload |

**iOS**

| Secret | How to get it |
|---|---|
| `APP_STORE_CONNECT_KEY_ID` | App Store Connect → Users and Access → Integrations |
| `APP_STORE_CONNECT_ISSUER_ID` | same page |
| `APP_STORE_CONNECT_KEY_CONTENT` | `base64 -i AuthKey_XXXX.p8` |
| `IOS_CERTIFICATE_BASE64` | base64 of your distribution certificate `.p12` |
| `IOS_CERTIFICATE_PASSWORD` | password for that `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | base64 of the `.mobileprovision` |

## Contributing

You're welcome to modify the project as you wish and contribute back to this project.

- If you spot a bug, please create an issue on GitHub for it
- If you're fixing a bug or adding a feature, please create a PR and I'll be happy to review and merge your changes.
- If you're thinking of creating your own app with this app as a base, you're welcome to do so, but that app must also be open source. See the LICENSE file for more information.

### How do I add my own prayer times?

The prayer data lives in `src/prayer_data`, named `LOCATION-YEAR.json` — for
example `london-2024.json`. To add a year, drop the file in and add one line
to `prayerDataLoaders` in `src/lib/PrayerTimeData.ts`. That map is the single
source of truth for which years exist, so nothing else needs updating.

If you're adding a new location that you want the user to be able to choose,
modify `SetupPage.tsx` to add a new option.

## Known issues

- **Prayer days are looked up by the device's local date.** The timetables
  are UK local times, so anyone in the UK sees the right day, but a user
  several timezones away can be shown the neighbouring day's times. The test
  suite is pinned to `Europe/London` for this reason.
- `useSettings` has a `useEffect` missing `dispatch` from its dependency
  array. oxlint reports it; fixing it changes render behaviour, so it has
  been left alone deliberately rather than changed blind.
- `src/prayer_data/london.json` is the pre-2022 year-agnostic table and is no
  longer read by anything.
