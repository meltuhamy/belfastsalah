---
name: verify-london-prayer-times
description: Drive London Prayer Times (meltuhamy/belfastsalah) on the Vite web app, an iOS Simulator, and an Android emulator, and capture evidence. Use when a change to screens, settings, the timetable, reminders, or widgets needs proof, including a regression pass over the feature map.
---

# Verify London Prayer Times

The app is one React UI on three surfaces: the Vite web app, the Capacitor iOS shell, and the Capacitor Android shell. Home-screen widgets exist only in the native shells. Prayer times are compiled in from `src/prayer_data/`. There is no database and no seed step.

On the web, settings live in `localStorage` under `CapacitorStorage.settings` (`@capacitor/preferences`). A browser context with empty storage shows **Set up** until **Done**. On a phone, the same key is the native Preferences store. Quitting and opening the app again, without clearing the app, is the persistence check. A reload in the browser is the web equivalent.

The device zone matters. The web drive forces `timezoneId: Europe/London`, so the "your device isn't on London time" notice stays hidden. A simulator or emulator uses the machine's zone, and this skill does not change that zone. When the machine is not on London time, the native pass taps **Keep London time** and then compares the strip to the London timetable. Do not compare the strip to the phone's own clock after that tap.

Two web servers can run side by side on different ports. One port cannot host two. Do not drive a simulator or emulator this run did not boot. Playwright's suite (`npm run test:e2e`) binds **5173** and is a separate instance from the server on 3000.

Node must be **24** (`.nvmrc`) for every command below.

```bash
. "$HOME/.nvm/nvm.sh"
nvm use
node -v   # v24.*
```

If `nvm use` says it switched to 24 but `node -v` does not, another `node` is earlier on `PATH`. Prepend the directory of `nvm which current` and check `node -v` again. Stay on the major version in `.nvmrc`.

`test -d node_modules || npm install` once. Do not add packages to `package.json` from a verification run.

## Launch

### Web

```bash
# Browser for the drive script. Already satisfied when Playwright's Chromium
# revision 1234 (pinned by @playwright/test) is installed, including when
# PLAYWRIGHT_BROWSERS_PATH points somewhere other than ~/.cache/ms-playwright.
# Otherwise this downloads a browser and does not edit package.json:
npx playwright install chromium

EVIDENCE=.cursor/skills/verify-london-prayer-times/evidence
PIDFILE=.cursor/skills/verify-london-prayer-times/vite.pid
mkdir -p "$EVIDENCE"

if curl -sf -o /dev/null "http://127.0.0.1:3000/"; then
  echo "127.0.0.1:3000 is already in use. Stop that process, or start vite on another port and set VERIFY_BASE_URL."
  exit 1
fi

node_modules/.bin/vite --host 127.0.0.1 --port 3000 --strictPort \
  > "$EVIDENCE/vite.log" 2>&1 &
echo $! > "$PIDFILE"
```

`npm run dev` is the same server without `--strictPort` and without a bound host. Prefer the command above so a busy port fails instead of sliding to 3001.

Keep that process alive until cleanup. If the shell reaps background jobs when it exits, run the vite line in a persistent terminal. The pid file is the process to stop later.

**Ready** means a person can use it. `curl` returning the HTML shell (`id="root"`) only means Vite is up. Then run the web doctor. Doctor is ready when it prints `"ok": true` and `"screen": "setup"` on a fresh browser profile. `"screen": "home"` is also a usable app, but only if that profile already completed setup.

If Vite exits immediately, read `evidence/vite.log`. Do not patch application source to make it boot.

### iOS

Needs Xcode, already installed. This skill does not install Xcode and does not accept its license. `xcodebuild` exits **69** with "You have not agreed to the Xcode license agreements" when the system record (`/Library/Preferences/com.apple.dt.Xcode.plist`, key `IDELastGMLicenseAgreedTo`) is for an older Xcode than `Contents/Resources/LicenseInfo.plist`. An administrator runs `sudo xcodebuild -license`. Do not type that password, and do not retry the build with different signing flags: the license check happens first.

```bash
node .cursor/skills/verify-london-prayer-times/native.mjs launch ios
```

That command builds the web bundle, runs `npx cap sync ios`, builds the `App` scheme for a shutdown iPhone 16 (or iPhone 17 if no iPhone 16 exists) with `xcodebuild`, boots that simulator, and installs `App.app`. The build is signed ad hoc with `ios/App/AdHocSigning.xcconfig`, as CI's simulator builds are, because a simulator only grants the App Group to a signed app. There is no unsigned fallback: a build that fails is a failed launch. The first `simctl boot` after `xcodebuild` can exit 53 while SimLaunchHost is still coming up (`Connection invalid`). Launch retries that transient XPC failure. It refuses to boot anything if a simulator is already booted. Derived data goes to `.cursor/skills/verify-london-prayer-times/.build/`, which is gitignored. `cap sync` copies the web build into `ios/App/App/public`, which `ios/.gitignore` already ignores. Do not commit native project drift from the sync.

Ready means the command prints `"ok": true` with the simulator name and udid. The app is installed and not yet driven.

### Android

```bash
node .cursor/skills/verify-london-prayer-times/native.mjs launch android
```

The command prints a preflight and exits 1 when the machine cannot compile or boot the app. It does not install an SDK package or an emulator image.

The app needs JDK **21** (`javac -version`, `android/app/build.gradle` sets `JavaVersion.VERSION_21`) and Android SDK platform **36** (`android/variables.gradle`). README also states JDK 21 and SDK 36. Gradle 8.14 cannot run on Android Studio's JBR 25. When `java_home -v 21` and the usual JDK directories have no JDK 21, `launch` downloads a Temurin JDK 21 (full JDK, with `javac`) into `.tools/jdk`. macOS Apple Silicon gets the aarch64 tarball; a linux cloud VM gets the x64 tarball. `JAVA_HOME` for the Gradle build is that JDK, and Maestro uses it too, so there is not a separate JRE.

On Linux the emulator also needs KVM. Check both of these and stop if either fails. Do not load kernel modules from this skill.

```bash
ls -l /dev/kvm
egrep -c '(vmx|svm)' /proc/cpuinfo
```

`/dev/kvm` must exist and be readable and writable by this user. The `egrep` count is non-zero when the CPU exposes virtualization. A cloud VM with a count of zero, or no `/dev/kvm`, cannot run the emulator until nested virtualization is turned on for that VM.

When the preflight passes, the same command builds the debug APK, boots an AVD, and installs it with `adb install -r -d` so a debug build can replace a store build that has a higher versionCode. Launch refuses to start when `adb devices` already lists a device, because adb is used without a serial and would install on, drive, and later kill that one. `VERIFY_ANDROID_AVD` selects that AVD by the name `emulator -list-avds` prints. When the variable is unset, launch prefers `Pixel_3a_API_33_arm64-v8a` if it exists, and otherwise boots the first listed AVD. On Linux, or when `DISPLAY` is unset, the emulator is started with `-no-window -no-audio -gpu swiftshader_indirect`. On a Mac the hypervisor is Hypervisor.framework (`sysctl -n kern.hv_support`), not KVM. Say which one the run used.

The API 33 system image ships Chrome/WebView 101, which has no `Array.prototype.toSorted`. `getAvailableYears` uses `toSorted`, so on that image the shell opens and the timetable stays on its skeleton. The console error is `TypeError: Object.keys(...).map(...).toSorted is not a function`. Set `VERIFY_ANDROID_AVD` to an arm64 AVD on API 34, 35, or 36 whose WebView is Chrome 110 or newer before `pass android`. This skill does not patch the app and does not create that AVD.

## Doctor

Web, read-only. A new browser context (empty `localStorage`) loads `/` and checks that either the setup location picker or the home prayer strip is on screen. It does not click.

```bash
node .cursor/skills/verify-london-prayer-times/drive.mjs doctor
```

Pass when stdout is one JSON object with `"ok": true`. `VERIFY_BASE_URL` overrides the origin (default `http://127.0.0.1:3000`). `CHROMIUM_PATH` overrides the browser executable.

Native, after `launch`. Opens the installed app and checks the accessibility tree for **Set up** or **Fajr** / **Prayer Times**. It does not tap.

```bash
node .cursor/skills/verify-london-prayer-times/native.mjs doctor ios
node .cursor/skills/verify-london-prayer-times/native.mjs doctor android
```

Pass when `"ok": true` and `"screen"` is `setup` or `home`. A fresh install is `setup`.

## Drive

### Web

Harness is Playwright via `drive.mjs` (`@playwright/test`, already a devDependency). Headless Chromium, Pixel 7, `timezoneId: Europe/London`, `colorScheme: light`, a fresh context per command.

| What | Handle |
|---|---|
| Setup is showing | `[data-testid=location-select]` |
| Home is showing | `[data-testid=prayer-strip]` |
| One column of that strip | `[data-testid=strip-cell]`, name and time in its two `span`s; the next prayer has `data-next="true"` |
| Date on the card | `[data-testid=day-date]` |
| Countdown | `[data-testid=countdown]` |
| Finish setup | button named `Done` |
| Settings | link named `Settings` (`ion-button[aria-label=Settings]`, route `/settings`) |
| Home | link named `Home` (route `/`) |

Ionic puts some controls in shadow DOM. Click the role or the row, not a coordinate. Location and theme pickers are `ion-select` with `interface="alert"`: tap the row, then `[role=radio]` and the button named `Choose`. See `e2e/support/app.ts` `chooseFromSelect`.

Smoke proof:

```bash
node .cursor/skills/verify-london-prayer-times/drive.mjs today
```

Empty storage, **Set up**, **Done**, read the six times, compare them to today's row in `src/prayer_data/london-<year>.json` (Shafi asr, the first asr column, each UTC instant formatted in `Europe/London`), read `CapacitorStorage.settings`, reload, and read the strip again. It does not call React setters and it does not freeze the clock. Between Isha and London midnight the strip and the date on the card are tomorrow's, and the **Tomorrow** badge is up, so that is the row and the date the drive expects then (`stripDay` in `timetable.mjs`). Exit 0 only when the strip matches the timetable and the reload still shows home.

`npm run test:e2e` is the web regression suite. It pins the clock with `page.clock.setFixedTime` before `goto`, uses port 5173, and writes an HTML report, not this skill's evidence directory. Use it for the suite. Use `drive.mjs` for proof against the server you launched. The feature files name the spec that covers each journey.

### iOS and Android

Playwright cannot attach to the Capacitor WKWebView, so the native pass does not go through `drive.mjs`. The driver is [Maestro](https://maestro.dev) 2.12.0, which taps and asserts the words on screen (Done, Fajr, Keep London time, Notify 5 minutes before prayer). It is not an npm dependency. `launch` downloads the CLI and, when the machine has no JDK 21, a Temurin JDK 21 into `.cursor/skills/verify-london-prayer-times/.tools/`. That directory is gitignored. Maestro and the Android Gradle build share that JDK. Gradle 8.14 cannot run on JDK 25, which is what Android Studio's JBR is, so a newer studio runtime is not a substitute.

The regression pass walks the feature map: setup, today's times against the timetable, the open month's name, setup still there after a relaunch, Hanafi asr and back, Belfast and back to London, the widget row, dark theme still dark after a relaunch, and the five-minute reminder still on after a relaunch.

The expected times are worked out again before each step, for the same reason: after a location's Isha its strip shows tomorrow, London and Belfast pass Isha at different moments, and a pass is long enough to cross one. A step that is running at that exact moment can still fail; run the pass again.

The countdown label is one span, `{prayer} in`, then the remaining time. iOS exposes `in` to the right of the prayer name. Android's WebView exposes ` in`, leading space included, and Maestro matches that whole string. The Android pass asserts `^ in$` to the right of a prayer name.

Android also joins the widget row into one string, `Widget appearance Colours and countdown for each home screen widget`. The pass matches that whole string. iOS keeps the title and the "Edit Widget" sentence as separate strings.

If adb drops the emulator in the middle of a flow (`device offline` or `Device server died`), that flow is run up to three times. Between tries the skill runs `adb reconnect` and `adb wait-for-device`. The emulator process is still up; the connection blips.

```bash
node .cursor/skills/verify-london-prayer-times/native.mjs pass ios
node .cursor/skills/verify-london-prayer-times/native.mjs pass android
```

Exit 0 only when every step in `evidence/<platform>-pass.json` has `"ok": true`. A step that cannot be reached is named in that JSON. Two of them are expected, not failures of the app:

- Changing month. `MonthPicker` is an `IonIcon` with no accessible name, so the pass does not tap by coordinate. It checks the open month's name. Counting rows stays on `npm run test:e2e` (`e2e/month-table.spec.ts`).
- Placing a home-screen widget. That is Springboard or the launcher, outside the app. The pass checks the in-app row: on iOS, "Touch and hold a widget, then choose Edit Widget"; on Android, "Colours and countdown for each home screen widget".

Do not weaken a timetable comparison to make a step pass. If the strip does not match `london-<year>.json` formatted in `Europe/London`, the journey fails.

## Evidence

`.cursor/skills/verify-london-prayer-times/.gitignore` ignores `evidence/`, `vite.pid`, `.tools/`, and `.build/`. Do not commit them.

Web, from `drive.mjs today`:

- `evidence/today-setup.png` — setup before **Done**
- `evidence/today-home.png` — home after **Done**
- `evidence/today.json` — London date, timetable row, strip text, countdown, highlighted prayer, stored location, reload result
- `evidence/vite.log`

Native, from `pass`. Screenshots are the simulator framebuffer (`simctl io screenshot`) or `adb exec-out screencap`, not a desktop browser.

- `evidence/ios-setup.png`, `evidence/ios-today-home.png`, `evidence/ios-month.png`, `evidence/ios-settings.png`, `evidence/ios-hanafi.png`, `evidence/ios-belfast.png`, `evidence/ios-widgets.png`, `evidence/ios-theme-dark.png`, `evidence/ios-reminders.png`
- `evidence/ios-pass.json` — expected times, device zone, and each step
- `evidence/ios-pass.mp4` — the pass, from `simctl io recordVideo`
- `evidence/ios-xcodebuild.log` when a build was attempted
- The same names with an `android-` prefix, plus `evidence/android-preflight.txt` when Android launch ran

Android screenshots use the `android-` prefix in place of `ios-`. A run that exits during preflight has the preflight text and no screenshots. Say so. Do not describe a screenshot that was not written.

Proof is the user path: the tap, the strip, the timetable row, and the relaunch. A mock of prayer data is not proof.

## Cleanup

Web: stop only the server whose pid you recorded. Never `pkill` by name. Never delete `evidence/`.

```bash
PIDFILE=.cursor/skills/verify-london-prayer-times/vite.pid
if [ -f "$PIDFILE" ]; then
  PID=$(cat "$PIDFILE")
  cmd=$(ps -p "$PID" -o command= 2>/dev/null || true)
  case "$cmd" in
    *vite*) kill "$PID" ;;
  esac
  rm -f "$PIDFILE"
fi
```

Native: shut down only the simulator or emulator this run booted, and terminate the app. Quit Simulator.app only when no simulator is still booted.

```bash
node .cursor/skills/verify-london-prayer-times/native.mjs cleanup ios
node .cursor/skills/verify-london-prayer-times/native.mjs cleanup android
```

After cleanup, `evidence/today-home.png` and `evidence/today.json` must still be there when the web drive ran, and `evidence/ios-today-home.png` plus `evidence/ios-pass.json` when the iOS pass ran. The pid file and the session file must not.

## Helpers

From the repo root:

```bash
node .cursor/skills/verify-london-prayer-times/drive.mjs doctor
node .cursor/skills/verify-london-prayer-times/drive.mjs today
node .cursor/skills/verify-london-prayer-times/native.mjs launch ios
node .cursor/skills/verify-london-prayer-times/native.mjs doctor ios
node .cursor/skills/verify-london-prayer-times/native.mjs pass ios
node .cursor/skills/verify-london-prayer-times/native.mjs cleanup ios
```

`drive.mjs` honours `VERIFY_BASE_URL`, `CHROMIUM_PATH`, and `VERIFY_EVIDENCE_DIR`. `native.mjs` honours `VERIFY_EVIDENCE_DIR`. Android `launch` also honours `VERIFY_ANDROID_AVD`. `timetable.mjs` is the shared London and Belfast formatting. It is imported by both drivers. Do not format a raw JSON clock string as the on-screen time: during British Summer Time the screen is an hour later.

The feature map is `features/README.md`. Run `/maintain-verification-skill` when the screens change. That pass reads each feature from source and drives it. It edits only this skill directory.
