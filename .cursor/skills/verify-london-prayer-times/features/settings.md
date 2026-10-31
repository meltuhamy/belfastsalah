# Settings

The screen at `/settings`. Same list as setup, without **Done**. Changes save on their own, 500ms after the last edit, and a toast says "Your settings have been saved".

## Sub-features

- Toolbar title **Settings**. The toolbar link named **Home** returns to `/` and the prayer strip.
- Location picker, `[data-testid=location-select]`, London or Belfast, same alert as setup.
- **Use Hanafi Asr** is an `ion-toggle` shown only for London. Belfast hides it and forces Shafi.
- Theme, `[data-testid=theme-select]`: Match device, Light, Dark, Dark after Maghrib. The effective theme adds or removes `ion-palette-dark` on `<html>`. Dark after Maghrib follows the next prayer (dark when the next prayer is Isha, Fajr, or Shuruq) and needs a saved location, so it cannot be judged on the setup screen before **Done**.
- Display zone. When the device zone is not `Europe/London`, home can show `[data-testid=time-zone-notice]`. **Use device time** (`[data-testid=time-zone-notice-use-device]`) and dismiss (`[data-testid=time-zone-notice-dismiss]`) both set `timeZoneNoticeSeen`. The settings list has `[data-testid=display-zone-select]` for the same choice. This skill's browser context is `Europe/London`, so the notice is absent; do not invent a failure for a missing notice in that context.
- Privacy policy row, same as setup: `[data-testid=privacy-policy-link]`, `href` `https://meltuhamy.com/privacy-policy/`, `target="_blank"`.
- Widget appearance is not on the web build. `[data-testid=widget-settings-link]` exists only when the native shell reports a widget settings screen. A browser must not be required to show it.

## How to get to it (user POV)

Finish setup. On the home screen, press the settings icon (the link named **Settings**) in the toolbar. Press the home icon (the link named **Home**) to come back.

## Driving it with Playwright

Complete setup first (**Done**, strip visible). Click the link named `Settings`. Wait until `[data-testid=location-select]` is visible and an `ion-title` contains `Settings`.

Change a control, wait at least 700ms, reload, and read it back. Then go home with the link named `Home` and read the strip.

End state that proves settings work:

- Choose Belfast in the location alert, wait 700ms, reload. The select value is `belfast`. On home, the strip's Fajr equals 15 February's Fajr only when the clock is actually 15 February; otherwise it equals the Belfast 2019 row for today's London month and day (Belfast has no other year file). The card text includes `Belfast`.
- Back on London, turn on **Use Hanafi Asr**, wait 700ms, reload, go home. The strip's Asr equals the second asr column of today's `london-<year>.json` row, formatted in `Europe/London`. The other five times stay on the Shafi row.
- Choose Dark in the theme alert. `<html>` has `ion-palette-dark` and `body`'s computed background colour changes from the light value. Reload. The class is still present. Choose Light. The class is absent even if the host prefers dark. To see that second case, launch the context with `colorScheme: "dark"`; the default for this skill is `light`.

Select values are DOM properties (`el.value`), which survive the once-a-second re-render. The stored blob is `JSON.parse(localStorage.getItem("CapacitorStorage.settings"))`.

## Gotchas

- Reloading before 700ms can miss the debounced write. The toast is not the proof; the value after reload is.
- Belfast never offers Hanafi. If the toggle is still on screen after the location value reads `belfast`, the journey fails.
- Dark after Maghrib on setup, before a location is saved, has no prayer times to follow. Judge it on the settings screen after setup, or on home.
- Do not require the widget row in a browser. Its absence there is the web build. Requiring the row would fail every desktop run.
- The privacy link must stay `target="_blank"`. Following it inside the same page leaves the app with no way back. Check the attribute; do not navigate the app to meltuhamy.com as the proof.
