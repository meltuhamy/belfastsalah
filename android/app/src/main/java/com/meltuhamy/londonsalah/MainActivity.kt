package com.meltuhamy.londonsalah

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.meltuhamy.londonsalah.reminder.PrayerRemindersPlugin
import com.meltuhamy.londonsalah.widget.PrayerWidgetPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Local plugins are not in capacitor.plugins.json, so they have to be
        // registered by hand - and before super.onCreate, which builds the
        // bridge that reads the registry.
        registerPlugin(PrayerWidgetPlugin::class.java)
        registerPlugin(PrayerRemindersPlugin::class.java)
        registerPlugin(DeviceClockPlugin::class.java)
        registerPlugin(KeepAwakePlugin::class.java)
        registerPlugin(TextSizePlugin::class.java)
        // Before the bridge, so the web layer's rescheduling comes after it.
        LegacyReminderAlarms.clearOnce(applicationContext)
        super.onCreate(savedInstanceState)
        // The WebView would otherwise zoom every font by the system font
        // scale on its own, px sizes included and with no cap. The page reads
        // the scale from TextSizePlugin and applies it itself (textScale.ts).
        bridge.webView.settings.textZoom = 100
    }
}
