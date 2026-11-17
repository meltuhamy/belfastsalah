package com.meltuhamy.londonsalah

import android.content.Context
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings

/**
 * Android's battery-optimisation list, read and opened.
 *
 * [PowerManager.isIgnoringBatteryOptimizations] needs no permission, and
 * neither does the list [Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS]
 * opens. The one-tap prompt
 * ([Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS]) needs
 * REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, which Play rejects unless being
 * exempt is the app's core function. This app does not declare it.
 */
object BatteryOptimization {
    fun isIgnoring(context: Context): Boolean {
        val powerManager =
            context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return powerManager.isIgnoringBatteryOptimizations(context.packageName)
    }

    /**
     * Some manufacturers' builds have no activity for the list, so fall back
     * to the app's own App info page, where battery usage is one tap away.
     */
    fun openSettings(context: Context) {
        val list = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(list)
        } catch (error: ActivityNotFoundException) {
            val appInfo = Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", context.packageName, null)
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(appInfo)
        }
    }
}
