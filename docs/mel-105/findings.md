# MEL-105 text-size screenshot audit

Read-only audit of `release/4.1` at commit `cc1db5ab47037ce4ed9d30a5446ce3ae9aef21e1` (`cc1db5a` — *Add Istanbul, and calculate London from 2027, with adhanfork (#79)*). No app code was changed.

Captured on 24 Nov 2026 (Europe/Istanbul). Location in the app: London, showing London time.

## Environment

| | |
|---|---|
| iOS | iPhone 16 simulator, iOS 18.6, UDID `6EA3984C-468C-41DB-9CE1-EAF70A9CA2EE` |
| Android | AVD `Pixel_3a_API_36_arm64-v8a` on `emulator-5554` |
| Max text size, iOS | `xcrun simctl ui 6EA3984C-468C-41DB-9CE1-EAF70A9CA2EE content_size accessibility-extra-extra-extra-large` |
| Restored, iOS | `xcrun simctl ui … content_size large` (iOS Dynamic Type default). Confirmed `large` after the audit. |
| Max text size, Android | `adb -s emulator-5554 shell settings put system font_scale 2.0` (accepted) |
| Restored, Android | `adb -s emulator-5554 shell settings put system font_scale 1.0`. Confirmed `1.0` after the audit. |
| JDK used to build | Verify skill bundled Temurin 21: `.cursor/skills/verify-london-prayer-times/.tools/jdk/Contents/Home` |

iOS in-app and widget screenshots, and Android in-app screenshots, were taken with Maestro / `simctl io screenshot` and `adb exec-out screencap`. iOS widgets are crops of the home screen at system content size `large` and `accessibility-extra-extra-extra-large`. Android widgets were pinned and cropped by the repo's `PreviewCapture#test4Widgets` at `font_scale` 2.0 and again at 1.0.

The app offers three iOS home-screen families (small, medium, large) and five Android providers (tile 1x1, compact 4x1, column 1x4, wide 4x2, tall 2x4). Files are named accordingly.

## iOS

| screen | scales? | cut off? | overlaps? | notes |
|---|---|---|---|---|
| today / upcoming card + strip (`ios-default-today.png`, `ios-max-today.png`) | Partially | No | No | The next-prayer card, countdown, prayer strip, and month timetable body stay essentially the same size (CSS uses px). The in-page **NOVEMBER** heading and calendar icon jump to a much larger size and push the table down (fewer rows visible). Prayer names and times stay fully visible. |
| month timetable (`ios-default-month.png`, `ios-max-month.png`) | No (table body) | No | No | The month table looks the same at both sizes: all names and times are fully visible. The nav title *November* does not show the dramatic scaling seen on Settings. |
| settings (`ios-default-settings.png`, `ios-max-settings.png`) | Yes — badly | Yes | Labels collide with trailing controls | At max size this is the worst iOS in-app screen. The section heading *Prayer time settings* wraps to three huge lines. Row labels truncate (*Use H…*, *Show ti…*). Trailing values (*London*, *London time*) disappear, leaving only chevrons/toggles. The help paragraph is huge and only partly on screen. About three rows fit. |
| widget small (`ios-default-widget-small.png`, `ios-max-widget-small.png`) | Mixed | No | No | The *Fajr in* pill, *London*, and date grow. The countdown shrinks (the widget uses `minimumScaleFactor`) so everything still fits. Prayer name and times stay fully visible. |
| widget medium (`ios-default-widget-medium.png`, `ios-max-widget-medium.png`) | Yes | Yes, at max | No — it truncates instead | At default size every name and time is complete. At max size all six times ellipsize (*05:…*, *07:…*, …) and *Maghrib* becomes *Magh…*. *Fajr*, *Shuruq*, *Duhr*, *Asr*, and *Isha* stay readable. |
| widget large (`ios-default-widget-large.png`, `ios-max-widget-large.png`) | Yes (body grows; countdown shrinks) | No | No | All six prayer names and times stay fully visible at max size. Spacing is tighter. The countdown is slightly smaller than at default, same `minimumScaleFactor` behaviour as the small widget. |

## Android

| screen | scales? | cut off? | overlaps? | notes |
|---|---|---|---|---|
| today / upcoming card + strip (`android-default-today.png`, `android-max-today.png`) | Yes | Yes | Yes | At max size the card wraps one word per line (*Fajr / in / 1h / 3m* and *Isha / was / 11h / 4m / ago*) and that block collides with *London* / *Showing London time* on the right. In the strip, times run together (*07:3011:5213:41 16:04*) and the **Isha** column is clipped off the right edge. The month heading already starts wrapping/truncating at the bottom of this screenshot. |
| month timetable (`android-default-month.png`, `android-max-month.png`) | Yes | Yes | Yes | At default size the table is clean, with today highlighted. At max size headers truncate (*Fajr Sh… Duhr Asr Ma… Isha*) and times break across two lines (*05:1* / *4* for 05:14, and so on), with day numbers cramped in the left margin. The max-size shot still shows the broken prayer strip at the top because the enlarged card left less room to scroll; the table damage is still clear. |
| settings (`android-default-settings.png`, `android-max-settings.png`) | Yes | Yes | Labels and values collide | Better than iOS settings, but still broken at max size: *Show times … Lo…*, *Prayer Notificati…*, *Theme Match dev…*, and *Time format Syst* are cut. *Location* / *London* and *Use Hanafi Asr* remain readable. The help paragraph wraps and is still fully readable. Fewer rows fit; *Time format* is clipped at the bottom of the screen. |
| widget tile 1x1 (`android-default-widget-tile.png`, `android-max-widget-tile.png`) | Yes | No | No | *Fajr in* and the countdown grow and remain fully visible. Tight, but usable. |
| widget compact 4x1 (`android-default-widget-compact.png`, `android-max-widget-compact.png`) | Yes | Yes, at max | Crowded against the highlight | At default size every name and time, plus the countdown, is complete. At max size names truncate (*Shur*, *Mag*) and times lose their minutes (*07:*, *11:*, …). The highlighted Fajr time becomes *05:* and the countdown *1:00:*. |
| widget column 1x4 (`android-default-widget-column.png`, `android-max-widget-column.png`) | Yes | Yes, at max | No | At default size everything is complete. At max size times lose their minutes (*05:*, *07:*, …) and some names truncate (*Shuru*, *Magh*). All six prayers are still identifiable. |
| widget wide 4x2 (`android-default-widget-wide.png`, `android-max-widget-wide.png`) | Yes | Yes, in the strip at max | Crowded against the highlight | The header (*Fajr in*, countdown, London, date) scales cleanly. The strip at max size truncates names (*Shu Duh Asr Ma Isha*) and drops minutes (*05: 07: 11: 13: 16: 17:*). |
| widget tall 2x4 (`android-default-widget-tall.png`, `android-max-widget-tall.png`) | Yes | Yes | Yes | At default size this is clean. At max size *London* disappears (only *Tue 24* remains), prayer names collapse to *Fa*, *S*, *D*, *A*, *M*, *Is*, and the highlight shows **Fa05:48** with the name and time running into each other. Times themselves stay complete. |

## What was not captured

- iOS lock-screen / accessory widget families (the brief asked for home-screen sizes only).
- A second, fully scrolled Android month shot at max size with the card and strip completely off-screen. The existing `android-max-month.png` already shows the broken table; it just still has the strip at the top.
- Real devices. This is simulator / emulator only (Pixel 3a is a small-phone stand-in).
- Live switching of the iOS content-size or Android font scale while a screen stays open, other than what is implied by taking the two sizes separately.

## Notes for the next step of MEL-105

The main gaps, from these screenshots:

1. **Android WebView actually follows `font_scale`, but the layout does not.** The today card, prayer strip, and month table become unreadable at 2.0 (wrapped countdown, concatenated times, missing Isha, split table cells).
2. **iOS in-app typography is inconsistent.** Most of the home and month UI is px-based and barely moves, except the *NOVEMBER* heading, which balloons. Settings (Ionic / native controls) scale hard and truncate.
3. **Widgets:** iOS medium and most Android sizes (compact, column, wide, tall) lose prayer names or times at the largest system size. The iOS large widget and the Android tile hold up better.

`cap sync` rewrote `ios/App/CapApp-SPM/Package.swift` and `Package.resolved` during the iOS build; those files were reverted and are not in this commit.
