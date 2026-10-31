# Reminders

The notifications group on setup and on settings. Off by default. On when the browser has granted notification permission and the toggle is on. The lead time defaults to 5 minutes.

## Sub-features

- The toggle's accessible name is **Notify before prayer**.
- Turning it on asks for notification permission. If the grant is anything other than `granted`, the toggle returns to off and the slider stays hidden.
- When it stays on, a slider appears. Its label (`.settings-list__range-label`) reads `Notify 5 minutes before prayer` at the default. The range is 0–20, step 1, `aria-label` "Minutes before prayer". 0 reads `Notify when it is time to pray`. 1 reads `Notify 1 minute before prayer`.
- The timer icon beside the slider (`[data-testid=notify-test-target]`) is a hidden diagnostic. A long press schedules a local notification a few seconds out (id 9999, clear of the prayer reminders 0–64) and opens `[data-testid=test-notification-toast]`. There is no visible control for it.
- Saved settings keep `notify` and `notifyMinutes`. After 700ms and a reload, the toggle and the label match what was set.

## How to get to it (user POV)

On **Set up**, or on **Settings** after **Done**, find the Notifications group under Prayer time settings. Turn on **Notify before prayer**. The browser asks for permission. The line under the toggle then states how many minutes before the prayer the reminder fires. Drag the slider to change it.

## Driving it with Playwright

Create the context with `permissions: ["notifications"]` in addition to the skill's usual Pixel 7 / `Europe/London` / light settings. Without that grant the toggle will not stay on, and the journey has not reached the slider.

Fresh context, `goto("/")`, wait for `[data-testid=location-select]`. Click the `ion-toggle` whose text is `Notify before prayer`.

End state that proves reminders work:

- `.settings-list__range-label` is visible and its text is `Notify 5 minutes before prayer`.
- Wait 700ms so the debounced write lands, but only after **Done** on the setup screen. On setup the toggle edits the draft; **Done** is what stores it. On the settings screen (after setup) the toggle stores by itself.
- Reload. The label is still `Notify 5 minutes before prayer`. `JSON.parse(localStorage.getItem("CapacitorStorage.settings"))` has `notify: true` and `notifyMinutes: 5`.
- Drag is optional. If you drag, release, and reload, `notifyMinutes` equals the released value and the label matches `describeNotifyMinutes` in `src/lib/notifyText.ts`. The knob must not jump back to 5 while the pointer is down. The screen re-renders every second and would reset a control that stored its in-flight value only in React state; the slider keeps that value locally until release.

The long-press diagnostic is not part of the end state. Prayer reminders themselves fire at a prayer time minus the offset. Do not wait for a real prayer time, and do not treat a toast from the hidden long-press as proof that the five-minute default was saved.

## Gotchas

- A context without notification permission fails this journey on purpose. Do not assert the slider in that context, and do not skip the permission so the toggle "works" without a grant. The grant is the browser's real permission prompt, which Playwright answers up front; it is not a stub of the reminder scheduler.
- On setup, a reload before **Done** discards the toggle. That is setup's rule, not a broken reminder. Commit with **Done**, then reload.
- The timer icon is wrapped so it can take a long-press, which takes it out of Ionic's `ion-icon[slot=start]` rules. If the journey is only checking layout, the icon is 24px wide and lines up with the other row icons (`e2e/notification-settings.spec.ts`). A missing slider label is the functional failure; a 16px icon is the layout failure.
- Headless Chromium will not show an OS notification banner. The proof is the control, the label, and the stored settings, not a pixel of a system banner.
- Ids: a test notification uses 9999. Prayer reminders use 0–64. Do not schedule 9999 as part of proving the default offset.
