package com.meltuhamy.londonsalah

import android.app.AlarmManager
import android.content.Context
import android.os.Build

/**
 * Clears, once, the reminder alarms a 3.x install left behind.
 *
 * 3.x targeted API 30, so its local-notifications plugin made each reminder's
 * PendingIntent with no mutability flag. The plugin now adds FLAG_MUTABLE on
 * API 31+, and the flags are part of a PendingIntent's identity: the app's
 * cancel-and-reschedule matches none of the old alarms, so they survive the
 * upgrade and fire next to the new ones. Each carries the Notification 3.x
 * built - its old timetable, and a small icon resource id that now names some
 * other drawable in this APK.
 *
 * A PendingIntent without a mutability flag cannot be made at this target
 * SDK, so the only way to reach them is AlarmManager.cancelAll, on API 34+.
 * On 31-33 they run out by themselves, within the ten-odd days 3.x scheduled
 * ahead. Below 31 the flags already matched and there was nothing to clear.
 *
 * This runs before the web layer loads, which reschedules every reminder and
 * the widgets' redraw alarm on each launch, so nothing current is lost.
 */
object LegacyReminderAlarms {
    private const val PREFS = "LegacyReminderAlarms"
    private const val CLEARED_KEY = "cleared"

    fun clearOnce(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(CLEARED_KEY, false)) {
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val alarmManager =
                context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.cancelAll()
        }
        prefs.edit().putBoolean(CLEARED_KEY, true).apply()
    }
}
