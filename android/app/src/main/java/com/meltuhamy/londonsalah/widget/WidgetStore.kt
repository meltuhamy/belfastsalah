package com.meltuhamy.londonsalah.widget

import android.content.Context

/**
 * Where the app leaves the payload for the widgets to read.
 *
 * Our own SharedPreferences file rather than the one @capacitor/preferences
 * uses: that file's naming and key layout are an implementation detail of the
 * plugin, and a widget that reads it would break on a plugin upgrade.
 */
object WidgetStore {
    private const val FILE = "prayer_widget"
    private const val KEY_PAYLOAD = "payload"

    fun write(context: Context, payload: String) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_PAYLOAD, payload)
            .apply()
    }

    fun read(context: Context): String? =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getString(KEY_PAYLOAD, null)
}
