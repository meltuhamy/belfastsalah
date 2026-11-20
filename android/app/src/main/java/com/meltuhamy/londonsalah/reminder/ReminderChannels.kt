package com.meltuhamy.londonsalah.reminder

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

/**
 * One notification channel per prayer, so Android's settings list Fajr, Duhr
 * and the rest, and how each one appears is the user's choice there.
 *
 * A channel's sound cannot change once it exists, so a prayer whose sound
 * changes in the app gets a new channel under a fresh id, created with the
 * old one's importance, vibration, lights, badge and lock screen settings,
 * and the old one is deleted. The user only ever sees one channel per prayer.
 *
 * The first time, each prayer's channel is copied from the channel it used
 * before: the one for its sound ([ReminderSounds]). So an upgrade changes
 * nothing about how reminders appear, and a new install gets what reminders
 * have always had - sound, no pop-up. The old per-sound channels are then
 * deleted, all but "default", which still carries every notification that is
 * not a prayer's.
 *
 * Which channel is current, and the sound it was made with, is kept in
 * SharedPreferences: the channel itself cannot say which in-app sound it was.
 */
object ReminderChannels {
    val PRAYERS = listOf("fajr", "shuruq", "duhr", "asr", "maghrib", "isha")

    private const val PREFS = "reminder_channels"
    private const val GENERATION = "generation"

    data class Current(val id: String, val sound: String)

    fun isPrayer(key: String?): Boolean = key != null && key in PRAYERS

    fun displayName(prayer: String): String = prayer.replaceFirstChar { it.uppercase() }

    /** The prayer's current channel, as last recorded, whether or not it still exists. */
    fun current(context: Context, prayer: String): Current? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val id = prefs.getString("$prayer.id", null) ?: return null
        val sound = prefs.getString("$prayer.sound", null) ?: return null
        return Current(id, ReminderSounds.normalise(sound))
    }

    /**
     * Makes every prayer's channel match [sounds] (prayer key to sound name;
     * a prayer left out keeps the sound its channel already has). Returns the
     * channel id for each prayer, or an empty map before Android 8, which
     * has no channels.
     */
    fun ensure(context: Context, sounds: Map<String, String>): Map<String, String> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return emptyMap()
        val ids = PRAYERS.associateWith { prayer ->
            ensureOne(context, prayer, sounds[prayer] ?: current(context, prayer)?.sound)
        }
        deleteLegacyChannels(context)
        return ids
    }

    /**
     * The id to post [prayer]'s reminder on, creating or replacing its channel
     * when it is missing or was made for another sound.
     */
    fun ensureOne(context: Context, prayer: String, sound: String?): String {
        val notifications = manager(context)
        val wanted = ReminderSounds.normalise(sound)
        val recorded = current(context, prayer)
        val existing = recorded?.let { notifications.getNotificationChannel(it.id) }
        if (recorded != null && existing != null && recorded.sound == wanted) {
            return recorded.id
        }

        // What the user has for this prayer now: its own channel, or before
        // the first time, the channel its sound used to post on.
        val template = existing ?: notifications.getNotificationChannel(
            ReminderSounds.channelId(wanted)
        )
        val templateSound = if (existing != null && recorded != null) recorded.sound else wanted

        val id = "prayer-$prayer-${nextGeneration(context)}"
        notifications.createNotificationChannel(
            buildChannel(context, id, prayer, wanted, template, templateSound)
        )
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("$prayer.id", id)
            .putString("$prayer.sound", wanted)
            .apply()
        if (existing != null) {
            notifications.deleteNotificationChannel(existing.id)
        }
        return id
    }

    /** The channel's importance as the user has it now, or null without one. */
    fun importance(context: Context, prayer: String): Int? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null
        val id = current(context, prayer)?.id ?: return null
        return manager(context).getNotificationChannel(id)?.importance
    }

    private fun buildChannel(
        context: Context,
        id: String,
        prayer: String,
        sound: String,
        template: NotificationChannel?,
        templateSound: String
    ): NotificationChannel {
        val importance = when {
            template == null ->
                if (sound == ReminderSounds.SILENT) {
                    NotificationManager.IMPORTANCE_LOW
                } else {
                    NotificationManager.IMPORTANCE_DEFAULT
                }
            // The silent channel was made low, which plays no sound at all.
            // Choosing a sound again has to be heard.
            templateSound == ReminderSounds.SILENT &&
                sound != ReminderSounds.SILENT &&
                template.importance == NotificationManager.IMPORTANCE_LOW ->
                NotificationManager.IMPORTANCE_DEFAULT
            else -> template.importance
        }
        val channel = NotificationChannel(id, displayName(prayer), importance)
        channel.description = "${displayName(prayer)} reminders"

        val uri = ReminderSounds.soundUri(context, sound)
        when {
            uri != null -> channel.setSound(uri, ReminderSounds.audioAttributes())
            sound == ReminderSounds.SILENT -> channel.setSound(null, null)
            // The default sound: whatever the user had picked for it, if anything.
            template != null && templateSound == ReminderSounds.DEFAULT ->
                channel.setSound(template.sound, template.audioAttributes)
        }

        if (template != null) {
            channel.enableLights(template.shouldShowLights())
            channel.lightColor = template.lightColor
            channel.lockscreenVisibility = template.lockscreenVisibility
            channel.setShowBadge(template.canShowBadge())
            channel.setBypassDnd(template.canBypassDnd())
            channel.vibrationPattern = template.vibrationPattern
        }
        channel.enableVibration(
            when {
                sound == ReminderSounds.SILENT && templateSound != ReminderSounds.SILENT -> false
                sound != ReminderSounds.SILENT && templateSound == ReminderSounds.SILENT -> true
                template != null -> template.shouldVibrate()
                else -> sound != ReminderSounds.SILENT
            }
        )
        return channel
    }

    /** The per-sound channels, once every prayer has its own. "default" stays. */
    private fun deleteLegacyChannels(context: Context) {
        val notifications = manager(context)
        for (sound in ReminderSounds.all) {
            if (sound == ReminderSounds.DEFAULT) continue
            if (notifications.getNotificationChannel(sound) != null) {
                notifications.deleteNotificationChannel(sound)
            }
        }
    }

    private fun nextGeneration(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val next = prefs.getInt(GENERATION, 0) + 1
        prefs.edit().putInt(GENERATION, next).apply()
        return next
    }

    private fun manager(context: Context): NotificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
}
