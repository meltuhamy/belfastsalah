package com.meltuhamy.londonsalah.widget

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
}
