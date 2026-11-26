package com.meltuhamy.londonsalah.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Bundle

/**
 * A widget whose layout depends only on which arrangement it is, not on how
 * big it has been made - only the Sky palette's picture is drawn to its size.
 * Subclasses choose a kind and nothing else.
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
            redraw(context, appWidgetManager, id, appWidgetManager.getAppWidgetOptions(id))
        }
        WidgetAlarms.scheduleNextBoundary(context)
    }

    /**
     * Nothing but the Sky palette's picture depends on the size, but that is
     * drawn to the widget's proportions, so a resize redraws it.
     */
    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        redraw(context, appWidgetManager, appWidgetId, newOptions)
    }

    private fun redraw(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        options: Bundle?
    ) {
        appWidgetManager.updateAppWidget(
            appWidgetId,
            WidgetRenderer.render(
                context,
                kind,
                WidgetConfig.load(context, appWidgetId),
                boxDp = widgetBoxDp(options)
            )
        )
    }

    override fun onEnabled(context: Context) {
        WidgetAlarms.scheduleNextBoundary(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        WidgetConfig.delete(context, appWidgetIds)
    }
}
