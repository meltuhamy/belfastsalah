package com.meltuhamy.londonsalah.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.SizeF
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.Locale.ROOT

/**
 * What each launcher tells the widgets about their size, for working out why a
 * widget is drawn the size it is on a phone nobody here has (MEL-370).
 *
 * Every redraw logs the options bundle it was given under [TAG]. A debuggable
 * build also keeps the last [KEEP] lines per widget and shows them at the
 * bottom of the appearance screen, as text a tester can copy into an issue.
 * A release build keeps none: nothing would show them, and a Sky widget
 * redraws every quarter of an hour.
 */
object WidgetSizeLog {
    const val TAG = "PrayerWidget"
    private const val PREFS = "widget_size_log"
    internal const val KEEP = 8
    private const val SEPARATOR = "\n"

    /** Whether this build shows the log: debuggable ones only. */
    fun shown(context: Context): Boolean =
        context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0

    fun record(
        context: Context,
        appWidgetId: Int,
        kind: WidgetKind,
        event: String,
        options: Bundle?,
        drawn: List<Pair<Int, Int>?>
    ) {
        val line = describe(context, kind, event, options, drawn)
        Log.i(TAG, "widget $appWidgetId $line")
        if (!shown(context)) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val key = key(appWidgetId)
        val stamp = SimpleDateFormat("MM-dd HH:mm:ss", Locale.US).format(Date())
        val kept = (listOf("$stamp $line") + entries(context, appWidgetId)).take(KEEP)
        prefs.edit().putString(key, kept.joinToString(SEPARATOR)).apply()
    }

    /** The newest first. */
    fun entries(context: Context, appWidgetId: Int): List<String> =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(key(appWidgetId), null)
            ?.split(SEPARATOR)
            ?.filter { it.isNotEmpty() }
            ?: emptyList()

    fun delete(context: Context, appWidgetIds: IntArray) {
        val edit = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        for (id in appWidgetIds) edit.remove(key(id))
        edit.apply()
    }

    private fun key(appWidgetId: Int) = "widget_$appWidgetId"

    internal fun describe(
        context: Context,
        kind: WidgetKind,
        event: String,
        options: Bundle?,
        drawn: List<Pair<Int, Int>?>
    ): String {
        fun int(key: String) = options?.getInt(key, 0) ?: 0
        val metrics = context.resources.displayMetrics
        val config = context.resources.configuration
        val orientation = when (config.orientation) {
            Configuration.ORIENTATION_LANDSCAPE -> "land"
            Configuration.ORIENTATION_PORTRAIT -> "port"
            else -> "?"
        }
        val min = "${int(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)}x" +
            "${int(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT)}"
        val max = "${int(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH)}x" +
            "${int(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)}"
        val sizes = reportedSizes(options)?.joinToString(",") { "${it.first}x${it.second}" }
        val growth = drawn.joinToString(" ") { box ->
            val g = WidgetGrowth.of(kind, box)
            val at = box?.let { "${it.first}x${it.second}" } ?: "none"
            "$at:" + String.format(ROOT, "%.2f/%.2f", g.body, g.heading)
        }
        return "$event ${kind.name} min=$min max=$max sizes=${sizes ?: "-"} " +
            "$orientation ${String.format(ROOT, "%.2f", metrics.density)}x " +
            "font=${config.fontScale} screen=${config.screenWidthDp}x${config.screenHeightDp} " +
            "api=${Build.VERSION.SDK_INT} drawn=[$growth]"
    }
}

/**
 * The sizes a launcher on Android 12 or later says the widget may be shown
 * at, one per orientation or posture, in dp - or null when it has said none.
 */
fun reportedSizes(options: Bundle?): List<Pair<Int, Int>>? {
    if (options == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null
    @Suppress("DEPRECATION")
    val sizes = options.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
    return sizes
        ?.map { it.width.toInt() to it.height.toInt() }
        ?.filter { it.first > 0 && it.second > 0 }
        ?.takeIf { it.isNotEmpty() }
}
