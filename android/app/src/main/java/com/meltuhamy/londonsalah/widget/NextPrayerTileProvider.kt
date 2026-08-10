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
            redraw(context, appWidgetManager, id, appWidgetManager.getAppWidgetOptions(id))
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
        redraw(context, appWidgetManager, appWidgetId, newOptions)
    }

    override fun onEnabled(context: Context) {
        WidgetAlarms.scheduleNextBoundary(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        WidgetConfig.delete(context, appWidgetIds)
    }

    private fun redraw(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        options: Bundle?
    ) {
        val width = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) ?: 0
        val height = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) ?: 0
        val sizeDp = listOf(width, height).filter { it > 0 }.minOrNull()

        appWidgetManager.updateAppWidget(
            appWidgetId,
            WidgetRenderer.render(
                context,
                WidgetKind.TILE,
                WidgetConfig.load(context, appWidgetId),
                sizeDp
            )
        )
    }
}
