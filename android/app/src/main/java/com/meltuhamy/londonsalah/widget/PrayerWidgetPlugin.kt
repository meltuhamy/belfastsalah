package com.meltuhamy.londonsalah.widget

import android.content.ActivityNotFoundException
import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.meltuhamy.londonsalah.BatteryOptimization

/**
 * The web layer's plugin. Widget updates go through here, and so does the
 * battery-optimisation check: LocalNotifications can say whether exact alarms
 * are allowed, which is how the settings screen reads that, but it has no
 * battery call. A second plugin would only wrap these two methods.
 */
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

    /**
     * True when this app is on the power allowlist, so Android is not
     * applying its battery restrictions. False is the usual state: a newly
     * installed app is optimised until the user says otherwise.
     */
    @PluginMethod
    fun isIgnoringBatteryOptimizations(call: PluginCall) {
        val result = JSObject()
        result.put("ignoring", BatteryOptimization.isIgnoring(context))
        call.resolve(result)
    }

    /** Opens the system list. The user turns optimisation off for this app there. */
    @PluginMethod
    fun openBatteryOptimizationSettings(call: PluginCall) {
        try {
            BatteryOptimization.openSettings(context)
            call.resolve()
        } catch (error: ActivityNotFoundException) {
            call.reject("Battery optimisation settings are not available", error)
        }
    }
}
