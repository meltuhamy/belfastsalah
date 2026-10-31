# Feature map

Index of user-facing behaviour the web app can show. Each file says what end state proves the feature, and how to drive it with Playwright against the Vite server from `../SKILL.md`.

Run `drive.mjs today` for the smoke proof. The other features are journeys an agent follows in its own Playwright script, with the same browser settings (fresh context, Pixel 7, `timezoneId: Europe/London`, `colorScheme: light`, `VERIFY_BASE_URL`).

| Feature | File | Proves it worked when |
|---|---|---|
| Today's prayer times | [today.md](today.md) | The six times on the home strip equal today's London timetable row, and a reload stays on home. |
| First-run setup | [setup.md](setup.md) | **Done** leaves setup, and a reload does not bring it back. Quitting without **Done** does. |
| Month table | [month.md](month.md) | The open month lists the calendar's day count and that month's timetable times, with today marked. |
| Settings | [settings.md](settings.md) | A location, asr method, or theme change is still on screen after a reload, and the home strip follows location and asr. |
| Reminders | [reminders.md](reminders.md) | With notification permission granted, the toggle stays on and the offset reads "Notify 5 minutes before prayer". |
