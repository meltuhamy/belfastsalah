# Feature map

Index of user-facing behaviour. Each file says what end state proves the feature, and how to drive it. Web journeys use Playwright against the Vite server from `../SKILL.md`. Native journeys are steps inside `node .cursor/skills/verify-london-prayer-times/native.mjs pass ios` (or `android` when that launch's preflight passes).

Run `drive.mjs today` for the web smoke proof. Run `native.mjs pass` for the native regression pass: it covers every row it can reach, and names the ones it cannot.

| Feature | File | Proves it worked when |
|---|---|---|
| Today's prayer times | [today.md](today.md) | The six times on the home strip equal today's London timetable row, and a reload stays on home. |
| First-run setup | [setup.md](setup.md) | **Done** leaves setup, and a reload does not bring it back. Quitting without **Done** does. |
| Month table | [month.md](month.md) | The open month lists the calendar's day count and that month's timetable times, with today marked. |
| Settings | [settings.md](settings.md) | A location, asr method, or theme change is still on screen after a reload, and the home strip follows location and asr. |
| Reminders | [reminders.md](reminders.md) | With notification permission granted, the toggle stays on and the offset reads "Notify 5 minutes before prayer". |
| Widgets | [widgets.md](widgets.md) | On a phone, Settings shows how to edit a widget. The web build has no widget row. The widget on the home screen is not driven from here. |
