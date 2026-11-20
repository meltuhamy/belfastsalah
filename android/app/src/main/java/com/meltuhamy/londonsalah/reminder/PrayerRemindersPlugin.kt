package com.meltuhamy.londonsalah.reminder

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * The web layer's way to replace the stored reminder list.
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
        // Every sound's channel, so the test notification can post to one
        // before any reminder has fired.
        ReminderSounds.ensureChannels(appContext)
        val payload = call.getString("payload")
        if (payload.isNullOrEmpty()) {
            ReminderStore.clear(appContext)
        } else {
            ReminderStore.write(appContext, payload)
        }
        ReminderAlarms.replan(appContext, System.currentTimeMillis())
        call.resolve()
    }

    /**
     * Creates every sound's channel without touching the reminder list. The
     * test day posts its notifications through the local-notifications plugin
     * onto these channels, and may run before any sync has created them.
     */
    @PluginMethod
    fun ensureChannels(call: PluginCall) {
        ReminderSounds.ensureChannels(context.applicationContext)
        call.resolve()
    }
}
