package com.meltuhamy.londonsalah.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent

/** Redraws every widget this app provides. */
object WidgetUpdater {
    private val PROVIDERS = listOf(
        NextPrayerTileProvider::class.java,
        PrayerTimesCompactWidgetProvider::class.java,
        PrayerTimesColumnWidgetProvider::class.java,
        PrayerTimesWidgetProvider::class.java,
        PrayerTimesVerticalWidgetProvider::class.java
    )

    /** Every widget of this app placed on a home screen, of any kind. */
    fun placedIds(context: Context): List<Int> {
        val manager = AppWidgetManager.getInstance(context)
        return PROVIDERS.flatMap {
            manager.getAppWidgetIds(ComponentName(context, it)).toList()
        }
    }

    fun refreshAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        for (provider in PROVIDERS) {
            val ids = manager.getAppWidgetIds(ComponentName(context, provider))
            if (ids.isEmpty()) continue
            context.sendBroadcast(
                Intent(context, provider).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                }
            )
        }
    }
}
