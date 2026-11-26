package com.meltuhamy.londonsalah

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * The phone's font scale, for the web layer to size its text by (MEL-105,
 * src/lib/textScale.ts).
 *
 * Left alone, the WebView applies the font scale itself, as text zoom, to
 * every font size on the page with no cap, so the day card's six times ran
 * into each other and Isha went off screen. MainActivity sets the zoom back to
 * 100% and the page scales its own text from this number instead, with a cap,
 * and lays out what no longer fits.
 *
 * No listener: fontScale is not in the activity's configChanges, so a change
 * restarts the activity and the page reads it again.
 */
@CapacitorPlugin(name = "TextSize")
class TextSizePlugin : Plugin() {

    @PluginMethod
    fun getFontScale(call: PluginCall) {
        val result = JSObject()
        result.put("fontScale", context.resources.configuration.fontScale.toDouble())
        call.resolve(result)
    }
}
