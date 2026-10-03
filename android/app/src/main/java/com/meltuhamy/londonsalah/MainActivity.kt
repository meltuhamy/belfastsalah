package com.meltuhamy.londonsalah

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.meltuhamy.londonsalah.widget.PrayerWidgetPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Local plugins are not in capacitor.plugins.json, so they have to be
        // registered by hand - and before super.onCreate, which builds the
        // bridge that reads the registry.
        registerPlugin(PrayerWidgetPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
