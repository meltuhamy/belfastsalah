package com.meltuhamy.londonsalah.reminder

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentResolver
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build

/**
 * The sounds a reminder can make, each on a notification channel of its own.
 *
 * A channel's sound cannot be changed once the channel exists, so choosing a
 * sound picks a channel rather than editing one. The ids are the sound names
 * TypeScript writes (`src/lib/reminderSound.ts`). "default" is the channel
 * reminders have always used, and stays as the user left it.
 */
object ReminderSounds {
    const val DEFAULT = "default"
    const val SILENT = "silent"
    const val ADHAN_COUNT = 5

    val adhans: List<String> = (1..ADHAN_COUNT).map { "adhan-$it" }
    val all: List<String> = listOf(DEFAULT, SILENT) + adhans

    /** Anything unknown, or missing (a list written before sounds), is the default. */
    fun normalise(sound: String?): String = if (sound != null && sound in all) sound else DEFAULT

    fun channelId(sound: String): String = normalise(sound)

    /** `res/raw/adhan_N.ogg` as a URI, or null for a sound with no file. */
    fun soundUri(context: Context, sound: String): Uri? {
        val known = normalise(sound)
        if (known !in adhans) return null
        val raw = known.replace('-', '_')
        return Uri.parse(
            "${ContentResolver.SCHEME_ANDROID_RESOURCE}://${context.packageName}/raw/$raw"
        )
    }

    private fun channelName(sound: String): String = when (sound) {
        DEFAULT -> "Default"
        SILENT -> "Silent"
        else -> "Adhan " + sound.removePrefix("adhan-")
    }

    /**
     * Creates every channel that is missing. Run before a reminder is posted
     * and on every sync, so the test notification - posted by the
     * local-notifications plugin onto one of these ids - finds its channel.
     * An existing channel is never touched: the user may have changed it.
     */
    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val notifications =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        for (sound in all) {
            if (notifications.getNotificationChannel(sound) != null) continue
            notifications.createNotificationChannel(newChannel(context, sound))
        }
    }

    private fun newChannel(context: Context, sound: String): NotificationChannel {
        val importance = if (sound == SILENT) {
            NotificationManager.IMPORTANCE_LOW
        } else {
            NotificationManager.IMPORTANCE_DEFAULT
        }
        val channel = NotificationChannel(sound, channelName(sound), importance)
        channel.description = when (sound) {
            DEFAULT -> "Default"
            SILENT -> "Prayer reminders without a sound"
            else -> "Prayer reminders that play ${channelName(sound)}"
        }
        if (sound == SILENT) {
            channel.setSound(null, null)
            channel.enableVibration(false)
        }
        soundUri(context, sound)?.let { uri ->
            channel.setSound(uri, audioAttributes())
            channel.enableVibration(true)
        }
        return channel
    }

    fun audioAttributes(): AudioAttributes =
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
}
