package com.meltuhamy.londonsalah.reminder

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentResolver
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build

/**
 * The sounds a reminder can make. The names are the ones TypeScript writes
 * (`src/lib/reminderSound.ts`).
 *
 * Reminders used to post on one channel per sound, with the sound names as
 * ids. Prayers now have a channel each ([ReminderChannels]), copied from these
 * the first time; of these only "default" is kept, for notifications that are
 * not a prayer's.
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
     * Creates the "default" channel if it is missing. It carries everything
     * that is not one prayer's reminder - the "reminders stop here" prompt
     * and the hidden test notification - and is the channel reminders always
     * used, so the user's settings on it are left alone. Prayers have their
     * own channels ([ReminderChannels]).
     */
    fun ensureDefaultChannel(context: Context) {
        ensureLegacyChannel(context, DEFAULT)
    }

    /**
     * The channel for [sound] from before prayers had their own. Only a
     * reminder stored without a prayer - armed by an older version, before
     * the app has synced since - posts on one, and finds it still there
     * unless the sync that would have replaced it has already run.
     */
    fun ensureLegacyChannel(context: Context, sound: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val notifications =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val id = channelId(sound)
        if (notifications.getNotificationChannel(id) != null) return
        notifications.createNotificationChannel(newChannel(context, id))
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
