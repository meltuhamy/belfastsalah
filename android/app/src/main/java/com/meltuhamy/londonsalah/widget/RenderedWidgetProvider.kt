package com.meltuhamy.londonsalah.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context

/**
 * A widget whose drawing depends only on which arrangement it is, not on how
 * big it has been made. Subclasses choose a kind and nothing else.
 *
 * The tile is the exception and has its own provider: it scales its text to
 * whatever size it has been dragged to, so it has to watch for resizes.
 */
abstract class RenderedWidgetProvider : AppWidgetProvider() {

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
