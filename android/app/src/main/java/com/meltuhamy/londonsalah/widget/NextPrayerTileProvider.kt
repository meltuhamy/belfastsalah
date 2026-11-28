package com.meltuhamy.londonsalah.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Bundle

/**
 * A square tile: the next prayer, and how long until it. Resizes to one cell.
 *
 * The drawing is in WidgetRenderer, shared with the configuration screen's
 * preview. All this does is decide when to redraw and how big the tile is.
 */
class NextPrayerTileProvider : AppWidgetProvider() {

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

    /** Resizing does not trigger onUpdate, so the fit is recomputed here. */
    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        redraw(context, appWidgetManager, appWidgetId, newOptions, "options")
    }

    override fun onEnabled(context: Context) {
        WidgetAlarms.scheduleNextBoundary(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        WidgetConfig.delete(context, appWidgetIds)
        WidgetSizeLog.delete(context, appWidgetIds)
    }

    private fun redraw(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        options: Bundle?,
        event: String
    ) {
        val boxes = WidgetBoxes.of(options)
        WidgetSizeLog.record(context, appWidgetId, WidgetKind.TILE, event, options, boxes.all)
        appWidgetManager.updateAppWidget(
            appWidgetId,
            WidgetRenderer.renderPlaced(
                context, WidgetKind.TILE, WidgetConfig.load(context, appWidgetId), boxes
            )
        )
    }
}
