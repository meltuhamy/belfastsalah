package com.meltuhamy.londonsalah.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context

/**
 * A countdown to the next prayer, and the day's six times with the next one
 * picked out. Subclasses only choose an arrangement; the drawing is in
 * WidgetRenderer, shared with the configuration screen's preview.
 */
abstract class PrayerTimesWidgetBase : AppWidgetProvider() {

    protected abstract val kind: WidgetKind

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            appWidgetManager.updateAppWidget(
                id,
                WidgetRenderer.render(context, kind, WidgetConfig.load(context, id))
            )
        }
        WidgetAlarms.scheduleNextBoundary(context)
    }

    override fun onEnabled(context: Context) {
        WidgetAlarms.scheduleNextBoundary(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        WidgetConfig.delete(context, appWidgetIds)
    }
}

/** Four cells wide: the six prayers in a row under the countdown. */
class PrayerTimesWidgetProvider : PrayerTimesWidgetBase() {
    override val kind = WidgetKind.WIDE
}

/** Two cells wide and tall: the same information stacked. */
class PrayerTimesVerticalWidgetProvider : PrayerTimesWidgetBase() {
    override val kind = WidgetKind.TALL
}
