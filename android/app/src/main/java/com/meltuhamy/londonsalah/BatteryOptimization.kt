package com.meltuhamy.londonsalah

import android.content.Context
import android.content.Intent
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

    fun openSettings(context: Context) {
        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }
}
