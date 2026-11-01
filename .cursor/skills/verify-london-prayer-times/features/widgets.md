# Widgets

Home-screen widgets on Android, and home and lock screen widgets on iOS. The app keeps them updated from the same timetable as the prayer strip. The web build has no widgets.

## Sub-features

- `ios-tip` tells the person to touch and hold a widget, then choose Edit Widget. iOS does not open widget settings from inside the app.
- `android-row` is a row named Widget appearance. Its subtitle is "Colours and countdown for each home screen widget". Tapping it asks the native shell to open the appearance screen.
- `placed-widget` is the widget sitting on the home screen or lock screen, showing the same next prayer as the app.

## How to get to it (user POV)

Finish setup. Open Settings. The row is in the Appearance group, under Theme.

Adding the widget itself is done from the home screen, not from this row. On iOS: touch and hold the home screen, add the Prayer Times widget. On Android: long-press the home screen and pick the widget. Editing one that is already placed is Edit Widget on iOS, and the Widget appearance row on Android.

## Driving it with the verify skill

Web: do not require the row. `[data-testid=widget-settings-link]` and `[data-testid=widget-settings-tip]` are absent because `widgetSettingsRoute()` in `src/lib/widgets.ts` returns null off a native shell. `npm run test:e2e` does not cover widgets. The widget views are covered by XCTest (`ios/App/PrayerWidgetsTests`) and Roborazzi (`android`), which are product tests, not this skill.

Native, included in `node .cursor/skills/verify-london-prayer-times/native.mjs pass ios` (and `android` when that launch succeeds):

- Open Settings and scroll to Widget appearance.
- On iOS the visible line is "Touch and hold a widget, then choose Edit Widget".
- On Android the visible line is "Colours and countdown for each home screen widget".
- Screenshot `evidence/<platform>-widgets.png`.

`placed-widget` is `verified-unreachable` from this harness. Placing a widget is Springboard or the launcher. The pass does not drive the home screen, and it does not tap by coordinate. Do not report the in-app row as proof that a widget on the home screen shows the right time.

## Gotchas

- The row is easy to miss below Theme. Scroll the settings list. A missing row on a phone is a failure. A missing row in the browser is the web build.
- iOS and Android do not share a control. Asserting the iOS sentence on Android, or the Android subtitle on iOS, fails the step.
- Opening the Android appearance screen only works once a widget has been added. The pass stops at the row.
