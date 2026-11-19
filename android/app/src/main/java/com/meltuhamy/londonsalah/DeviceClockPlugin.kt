package com.meltuhamy.londonsalah

import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.format.DateFormat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * The phone's own 12/24-hour switch.
 *
 * The web layer cannot see it: JavaScript's Intl only knows the language and
 * region, and a phone set to English (UK) can still be on a 12-hour clock.
 * DateFormat reads the real switch, which is what the System time format
 * follows.
 *
 * The switch is a system setting, so it can change while the app is open or
 * in the background; the observer is what lets the app follow it without a
 * relaunch. `handleOnResume` covers the case the observer misses - a change
 * made while the process was not running.
 */
@CapacitorPlugin(name = "DeviceClock")
class DeviceClockPlugin : Plugin() {

    private var observer: ContentObserver? = null
    private var lastUses24Hour: Boolean? = null

    override fun load() {
        val resolver = context.applicationContext.contentResolver
        val contentObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                publish()
            }
        }
        resolver.registerContentObserver(
            Settings.System.getUriFor(Settings.System.TIME_12_24),
            false,
            contentObserver
        )
        observer = contentObserver
        lastUses24Hour = uses24Hour()
    }

    override fun handleOnDestroy() {
        observer?.let {
            context.applicationContext.contentResolver.unregisterContentObserver(it)
        }
        observer = null
        super.handleOnDestroy()
    }

    override fun handleOnResume() {
        publish()
        super.handleOnResume()
    }

    @PluginMethod
    fun getFormat(call: PluginCall) {
        val result = JSObject()
        result.put("uses24Hour", uses24Hour())
        call.resolve(result)
    }

    private fun uses24Hour(): Boolean =
        DateFormat.is24HourFormat(context.applicationContext)

    /** Tells the web layer only when the answer actually differs. */
    private fun publish() {
        val current = uses24Hour()
        if (current == lastUses24Hour) {
            return
        }
        lastUses24Hour = current
        val data = JSObject()
        data.put("uses24Hour", current)
        notifyListeners("timeFormatChanged", data)
    }
}
