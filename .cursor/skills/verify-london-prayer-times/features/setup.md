# First-run setup

Shown whenever `CapacitorStorage.settings` is missing. The same list as Settings, plus a **Done** button that commits it. Nothing is stored before that click.

## Sub-features

- One screen. There is no **Next** button. The toolbar title is **Set up**.
- Groups, in order: Prayer time settings, Notifications, Appearance, About.
- Location defaults to `london` on `[data-testid=location-select]`. The options are London and Belfast.
- Tapping the location row, including its trailing edge away from the control, opens an `ion-alert`. Choosing Belfast and pressing **Choose** sets the select's value to `belfast`. Switching back to London sets `london`.
- **Use Hanafi Asr** is visible for London and absent for Belfast. Belfast's timetable has no second asr column.
- Theme defaults to Match device (`system`) on `[data-testid=theme-select]`. Changing it repaints immediately, before **Done**, via the setup screen's theme preview. The class on `<html>` is `ion-palette-dark` when the effective theme is dark.
- The privacy policy row (`[data-testid=privacy-policy-link]`) is visible, contains "Privacy policy" and "No data leaves your device", and its `href` is `https://meltuhamy.com/privacy-policy/` with `target="_blank"`.

## How to get to it (user POV)

Open the app before ever pressing **Done**. A fresh browser profile always lands here. Completing setup and then clearing site data brings it back.

## Driving it with Playwright

Fresh context, then `page.goto("/")` and wait for `[data-testid=location-select]`.

End state that proves setup works:

- Before **Done**, `localStorage.getItem("CapacitorStorage.settings")` is null. Reloading still shows the button named **Done**, and the location value is `london` even if Belfast was selected in the alert and not committed.
- Click the button named **Done**. The button goes away and `[data-testid=prayer-strip]` becomes visible.
- Wait at least 700ms (the write is debounced by 500ms). `CapacitorStorage.settings` parses as JSON with `"location":"london"` (or `belfast` if that option was chosen and **Choose** was pressed before **Done**).
- Reload. The strip is visible and **Done** is absent.

Read the select's value in the page, not from a React prop:

```js
await page.locator("[data-testid=location-select]").evaluate((el) => el.value)
```

Open the picker the way `chooseFromSelect` does in `e2e/support/app.ts`: tap the `ion-item` that contains the select, near its trailing edge, then `ion-alert` role `radio` by name (`London` or `Belfast`, exact) and the button named `Choose`.

## Gotchas

- The screen re-renders every second. A selection has to be read back after the click, not assumed from the event. The location control broke twice when setup was a separate radio group; the alert path above is the one that reaches the control.
- Ionic renders the select inside shadow DOM. A jsdom click on the row is not evidence. This journey has to run in Chromium.
- Choosing Belfast and reloading without **Done** must show London again. If a reload keeps Belfast, setup is committing early and the journey fails.
- Notifications: turning **Notify before prayer** on during setup only sticks when the browser grants notification permission. A headless context without `permissions: ["notifications"]` leaves the toggle off. That is a failed permission, not a failed location journey. Grant the permission only in the reminders feature.
- There is no account and no network call on this screen. Do not wait for one.
