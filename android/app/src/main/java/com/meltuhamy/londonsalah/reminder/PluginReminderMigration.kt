package com.meltuhamy.londonsalah.reminder

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher

/**
 * Cancels the reminder batch @capacitor/local-notifications still has pending.
 *
 * An upgrade from the month-long batch would otherwise fire those and the new
 * alarms together. The plugin's alarms are PendingIntents on
 * [TimedNotificationPublisher] whose request code is the notification id, and
 * it restores whatever is still in its "NOTIFICATION_STORE" prefs after a
 * reboot - so both have to go. The test notification (id 9999) is left alone.
 *
 * Ids run from 0 through [PLUGIN_REMINDER_ID_LIMIT], which is
 * ANDROID_NOTIFICATION_LIMIT in src/lib/reminderSchedule.ts. The prompt used
 * the limit itself as its id.
 */
object PluginReminderMigration {
    const val PLUGIN_REMINDER_ID_LIMIT = 181
    private const val TEST_NOTIFICATION_ID = 9999
    private const val STORE = "NOTIFICATION_STORE"

    fun cancel(context: Context) {
        val alarmManager =
            context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val notifications =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        for (id in 0..PLUGIN_REMINDER_ID_LIMIT) {
            val pending = PendingIntent.getBroadcast(
                context,
                id,
                Intent(context, TimedNotificationPublisher::class.java),
                pendingFlags()
            )
            alarmManager.cancel(pending)
            pending.cancel()
            notifications.cancel(id)
        }

        val prefs = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
        val editor = prefs.edit()
        var changed = false
        for (key in prefs.all.keys) {
            val id = key.toIntOrNull() ?: continue
            if (id == TEST_NOTIFICATION_ID || id !in 0..PLUGIN_REMINDER_ID_LIMIT) {
                continue
            }
            editor.remove(key)
            changed = true
        }
        if (changed) {
            editor.commit()
        }
    }

    private fun pendingFlags(): Int {
        val mutable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_MUTABLE
        } else {
            0
        }
        return mutable or PendingIntent.FLAG_UPDATE_CURRENT
    }
}
