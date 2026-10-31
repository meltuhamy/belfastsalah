---
name: verify-london-prayer-times
description: Drive the London Prayer Times Ionic app (meltuhamy/belfastsalah) in a desktop browser against the Vite dev server, and capture evidence. Use when a change to screens, settings, timetable display, or reminders needs proof on the real web app, or when launch, doctor, or cleanup of that local instance is required. Does not cover the Android or iOS shells or their widgets.
---

# Verify London Prayer Times

The primary surface is the web app. Users install the Capacitor shells (Android and iOS, plus home-screen widgets), but every screen an agent can drive here is the same React UI served by Vite. Widget tests need Gradle or Xcode and do not run in this skill.

Prayer times are compiled in from `src/prayer_data/`. There is no database and no seed step. On the web, settings live in `localStorage` under `CapacitorStorage.settings` (`@capacitor/preferences`). A browser context with empty storage is the empty data dir: the app shows **Set up** until **Done** is pressed.

Two dev servers can run side by side on different ports. Storage is per origin, so `127.0.0.1:3000` and `127.0.0.1:3001` do not share settings. One port cannot host two servers. Playwright's own suite (`npm run test:e2e`) binds **5173** and is a separate instance; do not treat a green e2e run as this skill's evidence.

## Launch

From the repo root. Node must be **24** (`.nvmrc`). `npm install` once if `node_modules` is missing. No extra packages.

```bash
. "$HOME/.nvm/nvm.sh"
nvm use
node -v   # v24.*
```

If `nvm use` says it switched to 24 but `node -v` does not, another `node` is earlier on `PATH`. Prepend the directory of `nvm which current` and check `node -v` again before launching. Stay on the major version in `.nvmrc`.

```bash
test -d node_modules || npm install
# Browser for the drive script. Already satisfied when ~/.cache/ms-playwright
# has Chromium revision 1234 (the revision pinned by @playwright/test).
# Otherwise, this downloads a browser and does not edit package.json:
npx playwright install chromium

EVIDENCE=.cursor/skills/verify-london-prayer-times/evidence
PIDFILE=.cursor/skills/verify-london-prayer-times/vite.pid
mkdir -p "$EVIDENCE"

# Refuse to attach to someone else's server.
if curl -sf -o /dev/null "http://127.0.0.1:3000/"; then
  echo "127.0.0.1:3000 is already in use. Stop that process, or start vite on another port and set VERIFY_BASE_URL."
  exit 1
fi

node_modules/.bin/vite --host 127.0.0.1 --port 3000 --strictPort \
  > "$EVIDENCE/vite.log" 2>&1 &
echo $! > "$PIDFILE"
```

`npm run dev` is the same server (Vite, port 3000 in `vite.config.ts`) without `--strictPort` and without a bound host. Prefer the command above so a busy port fails instead of sliding to 3001.

Keep that process alive until cleanup. If the shell reaps background jobs when it exits, run the vite line in a persistent terminal. The pid file is the process to stop later.

**Ready** means a person can use it, not merely that HTTP answers. `curl` returning the HTML shell (`id="root"`) only means Vite is up. Then run doctor (below). Doctor is ready when it prints `"ok": true` and `"screen": "setup"` on a fresh browser profile. `"screen": "home"` is also a usable app, but only if that profile already completed setup.

If Vite exits immediately, read `evidence/vite.log`. Do not patch application source to make it boot. Record the exact error in the note you hand back.

## Doctor

Read-only. Opens a **new** browser context (empty `localStorage`), loads `/`, and checks that either the setup location picker or the home prayer strip is actually on screen. It does not click.

```bash
node .cursor/skills/verify-london-prayer-times/drive.mjs doctor
```

Pass when stdout is a single JSON object with `"ok": true`. `"screen": "setup"` means this profile has not been committed yet, which is the empty-storage state. A connection error or a timeout means the instance is not worth driving.

`VERIFY_BASE_URL` overrides the origin (default `http://127.0.0.1:3000`). `CHROMIUM_PATH` overrides the browser executable when Playwright's downloaded Chromium is absent.

## Drive

Harness is Playwright via `drive.mjs` (`@playwright/test`, already a devDependency). The browser is headless Chromium, Pixel 7 viewport, `timezoneId: Europe/London`, `colorScheme: light`, a fresh context per command. London is the device zone the timetable is printed for, so the "your device is not on London time" notice stays hidden and the clock on screen matches `src/prayer_data`.

Stable handles (the same ones `e2e/support/app.ts` uses):

| What | Handle |
|---|---|
| App has loaded on setup | `[data-testid=location-select]` |
| Home screen is showing | `[data-testid=prayer-strip]` |
| One column of that strip | `[data-testid=strip-cell]`, name and time in its two `span`s; the next prayer has `data-next="true"` |
| Date on the card | `[data-testid=day-date]` |
| Countdown | `[data-testid=countdown]` |
| Finish setup | button named `Done` |
| Settings | link named `Settings` (`ion-button[aria-label=Settings]`, route `/settings`) |
| Home | link named `Home` (route `/`) |

Ionic puts some controls in shadow DOM. Click the role or the row, not a coordinate. The location and theme pickers are `ion-select` with `interface="alert"`: tap the row, then `[role=radio]` and the button named `Choose`. See `e2e/support/app.ts` `chooseFromSelect`.

**Today's prayer times** (the mapped feature to run for a smoke proof):

```bash
node .cursor/skills/verify-london-prayer-times/drive.mjs today
```

That command is the user path: empty storage, **Set up**, **Done**, read the six times, compare them to today's row in `src/prayer_data/london-<year>.json` (Shafi asr, the first asr column, each UTC instant formatted in `Europe/London`), read `CapacitorStorage.settings`, reload, and read the strip again. It does not call React setters and it does not freeze the clock. Exit 0 only when the strip matches the timetable and the reload still shows home.

Other features are driven with the same browser settings. Journeys and selectors are in `features/`. Do not weaken a journey when the timetable file for that date is missing: fail, and the reason belongs in that feature's Gotchas.

`npm run test:e2e` is the regression suite. It pins the clock with `page.clock.setFixedTime` **before** `goto`, uses port 5173, and writes an HTML report, not this skill's evidence directory. Use it when you want the suite. Use `drive.mjs` when you need proof of one feature against a server you launched.

## Evidence

`drive.mjs today` writes all of these and does not delete them. `.cursor/skills/verify-london-prayer-times/.gitignore` ignores `evidence/` and `vite.pid`, so a later run cannot commit them.

- `.cursor/skills/verify-london-prayer-times/evidence/today-setup.png` — setup before **Done**
- `.cursor/skills/verify-london-prayer-times/evidence/today-home.png` — home after **Done**, strip visible
- `.cursor/skills/verify-london-prayer-times/evidence/today.json` — London date, timetable row, strip text, countdown, highlighted prayer, stored location, reload result
- `.cursor/skills/verify-london-prayer-times/evidence/vite.log` — server log from launch

Proof is the user path above: the click, the strip, the timetable row, and the reload. A mock of prayer data is not proof. The only local stand-in is the browser clock's zone (`Europe/London`), which is the zone a London phone is already in.

## Cleanup

Stop only the server whose pid you recorded. Never `pkill` by name. Never delete `evidence/`.

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

After cleanup, `evidence/today-home.png` and `evidence/today.json` must still be there. The pid file must not.

## Helpers

`drive.mjs` is executable. From the repo root:

```bash
node .cursor/skills/verify-london-prayer-times/drive.mjs doctor
node .cursor/skills/verify-london-prayer-times/drive.mjs today
```

Both honour `VERIFY_BASE_URL` and `CHROMIUM_PATH`. `VERIFY_EVIDENCE_DIR` overrides where `today` writes its files.
