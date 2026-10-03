package com.meltuhamy.londonsalah.widget

import android.content.Intent
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/** The web layer's only way in: hand over a payload, redraw, set the alarm. */
@CapacitorPlugin(name = "PrayerWidget")
class PrayerWidgetPlugin : Plugin() {

    @PluginMethod
    fun update(call: PluginCall) {
        val payload = call.getString("payload")
        if (payload == null) {
            call.reject("payload is required")
            return
        }
        val appContext = context.applicationContext
        WidgetStore.write(appContext, payload)
        WidgetUpdater.refreshAll(appContext)
        WidgetAlarms.scheduleNextBoundary(appContext)
        call.resolve()
    }

    /**
     * Opens the appearance settings for a placed widget. Android only shows
     * the configuration screen when a widget is added, and whether it can be
     * reopened afterwards is up to the launcher.
     */
    @PluginMethod
    fun openSettings(call: PluginCall) {
        val intent = Intent(context, WidgetPickerActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        call.resolve()
    }
}
