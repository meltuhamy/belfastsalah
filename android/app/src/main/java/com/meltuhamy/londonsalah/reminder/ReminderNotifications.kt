package com.meltuhamy.londonsalah.reminder

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.meltuhamy.londonsalah.MainActivity
import com.meltuhamy.londonsalah.R

/**
 * Posts one reminder from the stored list, on the channel for its sound
 * ([ReminderSounds]).
 *
 * The default sound's channel id matches @capacitor/local-notifications'
 * default, so a phone that already has that channel keeps the user's sound
 * and importance instead of growing a second row. The test notification
 * stays on the plugin and uses a different id.
 */
object ReminderNotifications {
    private const val CONTENT_REQUEST_CODE = 8190

    /** Posts only if [payload], the current list, still has this reminder. */
    fun show(context: Context, intent: Intent, payload: ReminderPayload) {
        val at = intent.getLongExtra(ReminderAlarms.EXTRA_AT, Long.MIN_VALUE)
        val title = intent.getStringExtra(ReminderAlarms.EXTRA_TITLE) ?: return
        if (at == Long.MIN_VALUE) return

        val entry = payload.reminders.find { it.at == at && it.title == title } ?: return

        val notifications =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        ReminderSounds.ensureChannels(context)

        val open = PendingIntent.getActivity(
            context,
            CONTENT_REQUEST_CODE,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = notificationBuilder(context, entry.sound)
            .setSmallIcon(R.drawable.ic_stat_name)
            .setContentTitle(entry.title)
            .setContentText(entry.body)
            .setWhen(entry.at)
            .setShowWhen(true)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_REMINDER)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setContentIntent(open)
            .build()

        try {
            notifications.notify(notificationId(entry), notification)
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS was revoked. The next open of the app asks
            // again; the alarm chain still has to move on.
        }
    }

    private fun notificationBuilder(context: Context, sound: String): Notification.Builder {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return Notification.Builder(context, ReminderSounds.channelId(sound))
        }
        // Android 7 has no channels: the sound goes on the notification.
        @Suppress("DEPRECATION")
        val builder = Notification.Builder(context)
        val uri = ReminderSounds.soundUri(context, sound)
        @Suppress("DEPRECATION")
        when {
            uri != null -> builder.setSound(uri, ReminderSounds.audioAttributes())
            sound == ReminderSounds.DEFAULT -> builder.setDefaults(Notification.DEFAULT_SOUND)
        }
        return builder
    }

    /**
     * Stable for a given reminder, and clear of the plugin's ids (0..181 and
     * the test notification at 9999) so the two never replace each other.
     */
    private fun notificationId(entry: ReminderEntry): Int {
        var id = (entry.at xor entry.title.hashCode().toLong()).toInt() and 0x7fffffff
        if (id <= PluginReminderMigration.PLUGIN_REMINDER_ID_LIMIT || id == 9999) {
            id += 10_000
        }
        return id
    }
}
