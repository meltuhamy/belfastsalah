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
            redraw(context, appWidgetManager, id, appWidgetManager.getAppWidgetOptions(id), "update")
        }
        WidgetAlarms.scheduleNextBoundary(context)
    }

    /**
     * A resize, a fold or the launcher's sizes changing: the widget is drawn
     * again for each box it may now be shown in (WidgetBoxes).
     */
    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        redraw(context, appWidgetManager, appWidgetId, newOptions, "options")
    }

    private fun redraw(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        options: Bundle?,
        event: String
    ) {
        val boxes = WidgetBoxes.of(options)
        WidgetSizeLog.record(context, appWidgetId, kind, event, options, boxes.all)
        appWidgetManager.updateAppWidget(
            appWidgetId,
            WidgetRenderer.renderPlaced(
                context, kind, WidgetConfig.load(context, appWidgetId), boxes
            )
        )
    }

    override fun onEnabled(context: Context) {
        WidgetAlarms.scheduleNextBoundary(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        WidgetConfig.delete(context, appWidgetIds)
        WidgetSizeLog.delete(context, appWidgetIds)
    }
}
