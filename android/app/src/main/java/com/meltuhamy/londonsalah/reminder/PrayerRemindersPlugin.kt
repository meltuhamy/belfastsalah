package com.meltuhamy.londonsalah.reminder

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * The web layer's way to replace the stored reminder list, and to reach each
 * prayer's notification channel.
 *
 * An empty payload is reminders switched off: the list and every alarm go.
 * Anything else is the list TypeScript just built, and the next two days are
 * armed before this returns, so a lead-time change has already moved the
 * alarms by the time the settings screen settles.
 */
@CapacitorPlugin(name = "PrayerReminders")
class PrayerRemindersPlugin : Plugin() {

    @PluginMethod
    fun sync(call: PluginCall) {
        val appContext = context.applicationContext
        // Before the new alarms, so the plugin's old batch cannot fire beside them.
        PluginReminderMigration.cancel(appContext)
        ReminderSounds.ensureDefaultChannel(appContext)
        val payload = call.getString("payload")
        if (payload.isNullOrEmpty()) {
            ReminderStore.clear(appContext)
        } else {
            ReminderPayload.parse(payload)?.let { parsed ->
                ReminderChannels.ensure(appContext, parsed.channels)
            }
            ReminderStore.write(appContext, payload)
        }
        ReminderAlarms.replan(appContext, System.currentTimeMillis())
        call.resolve()
    }

    /**
     * Brings every prayer's channel up to the sounds given (`sounds`, prayer
     * key to sound name) without touching the reminder list, and says how
     * each one appears now. The test day posts on these channels through the
     * local-notifications plugin, and the settings screens show what Android
     * has for each prayer.
     *
     * Resolves `{ enabled, channels: { fajr: { id, importance } } }`, with
     * `channels` empty before Android 8, which has none.
     */
    @PluginMethod
    fun ensureChannels(call: PluginCall) {
        val appContext = context.applicationContext
        ReminderSounds.ensureDefaultChannel(appContext)
        val soundsJson = call.getObject("sounds") ?: JSObject()
        val sounds = ReminderChannels.PRAYERS
            .filter { soundsJson.has(it) }
            .associateWith { soundsJson.getString(it) ?: ReminderSounds.DEFAULT }
        val ids = ReminderChannels.ensure(appContext, sounds)

        val channels = JSObject()
        for ((prayer, id) in ids) {
            val channel = JSObject()
            channel.put("id", id)
            ReminderChannels.importance(appContext, prayer)?.let { channel.put("importance", it) }
            channels.put(prayer, channel)
        }
        val manager =
            appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val result = JSObject()
        result.put("enabled", manager.areNotificationsEnabled())
        result.put("channels", channels)
        call.resolve(result)
    }

    /**
     * Opens Android's settings page for one prayer's channel, where the user
     * chooses whether it pops up, its vibration, and the rest. Falls back to
     * the app's notification settings when the prayer has no channel yet.
     */
    @PluginMethod
    fun openChannelSettings(call: PluginCall) {
        val prayer = call.getString("prayer")
        val channelId = prayer
            ?.takeIf { ReminderChannels.isPrayer(it) }
            ?.let { ReminderChannels.current(context, it)?.id }
        val intent = when {
            Build.VERSION.SDK_INT < Build.VERSION_CODES.O ->
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(android.net.Uri.fromParts("package", context.packageName, null))
            channelId != null ->
                Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                    .putExtra(Settings.EXTRA_CHANNEL_ID, channelId)
            else ->
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        }
        try {
            context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: android.content.ActivityNotFoundException) {
            // Some builds have no page for one channel; the app's page has them all.
            context.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(android.net.Uri.fromParts("package", context.packageName, null))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        }
        call.resolve()
    }

    private var defaultSound: Ringtone? = null

    /**
     * Plays the phone's notification sound, which is what "Default sound"
     * reminders make, so it can be heard in the sound list like the adhans.
     * The page has no file for it.
     */
    @PluginMethod
    fun playDefaultSound(call: PluginCall) {
        defaultSound?.stop()
        val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val ringtone = RingtoneManager.getRingtone(context, uri)
        if (ringtone == null) {
            call.reject("this phone has no notification sound")
            return
        }
        ringtone.audioAttributes = ReminderSounds.audioAttributes()
        ringtone.play()
        defaultSound = ringtone
        call.resolve()
    }

    @PluginMethod
    fun stopDefaultSound(call: PluginCall) {
        defaultSound?.stop()
        defaultSound = null
        call.resolve()
    }
}
