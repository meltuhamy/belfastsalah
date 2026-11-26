package com.meltuhamy.londonsalah

import android.view.WindowManager
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Keeps the screen on while the app is in front (MEL-356), for the
 * `keepAwake` setting: src/lib/keepAwake.ts says when it changes.
 *
 * FLAG_KEEP_SCREEN_ON belongs to the activity's window, so it only ever holds
 * while the app is visible and needs no permission or wake lock - the system
 * drops it the moment the app is not on screen. The plugin remembers what was
 * asked and sets it again on resume, in case the activity was recreated in
 * between and its new window came up without it.
 */
@CapacitorPlugin(name = "KeepAwake")
class KeepAwakePlugin : Plugin() {

    private var keepAwake = false

    @PluginMethod
    fun set(call: PluginCall) {
        keepAwake = call.getBoolean("keepAwake", false) ?: false
        apply()
        call.resolve()
    }

    override fun handleOnResume() {
        apply()
        super.handleOnResume()
    }

    private fun apply() {
        val activity = activity ?: return
        val on = keepAwake
        activity.runOnUiThread {
            if (on) {
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }
}
