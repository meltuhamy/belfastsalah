package com.meltuhamy.londonsalah.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import com.meltuhamy.londonsalah.MainActivity
import com.meltuhamy.londonsalah.R

/**
 * A square tile: the next prayer, and how long until it.
 *
 * The countdown is a Chronometer rather than repeated redraws. The launcher
 * ticks it in its own process, so a live seconds display costs no wakeups and
 * no battery - a widget cannot redraw itself once a second, and should not
 * try. All this provider does is set where the count starts from.
 */
class NextPrayerTileProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            val options = appWidgetManager.getAppWidgetOptions(id)
            appWidgetManager.updateAppWidget(id, buildViews(context, id, options))
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
        appWidgetManager.updateAppWidget(appWidgetId, buildViews(context, appWidgetId, newOptions))
    }

    override fun onEnabled(context: Context) {
        WidgetAlarms.scheduleNextBoundary(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        WidgetConfig.delete(context, appWidgetIds)
    }

    private fun buildViews(
        context: Context,
        appWidgetId: Int,
        options: Bundle?
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_next_prayer_tile)
        views.setOnClickPendingIntent(R.id.tile_root, openApp(context))

        val config = WidgetConfig.load(context, appWidgetId)
        views.setInt(R.id.tile_root, "setBackgroundColor", config.backgroundColor(context))
        views.setTextColor(R.id.tile_prayer, config.secondaryTextColor(context))
        views.setTextColor(R.id.tile_countdown, config.primaryTextColor(context))
        views.setTextColor(R.id.tile_location, config.secondaryTextColor(context))

        // At one cell there is room for the prayer and the countdown, and
        // nothing else. Two cells is roughly 110dp; below that, drop the
        // location rather than let three lines collide.
        val heightDp = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) ?: 0
        val compact = heightDp in 1 until 100
        views.setViewVisibility(
            R.id.tile_location,
            if (compact) View.GONE else View.VISIBLE
        )

        val payload = WidgetPayload.parse(WidgetStore.read(context))
        val next = payload?.nextAfter(System.currentTimeMillis())

        if (payload == null || next == null) {
            // Nothing usable, or the written window has run out. Say so rather
            // than showing a stale time: a wrong prayer time is worse than none.
            views.setTextViewText(R.id.tile_prayer, context.getString(R.string.widget_unavailable))
            views.setTextViewText(R.id.tile_location, context.getString(R.string.widget_open_app))
            views.setChronometer(R.id.tile_countdown, SystemClock.elapsedRealtime(), null, false)
            views.setTextViewText(R.id.tile_countdown, "")
            return views
        }

        views.setTextViewText(R.id.tile_location, payload.locationLabel)
        WidgetCountdown.bind(
            views, context, config, next, R.id.tile_countdown, R.id.tile_prayer
        )

        return views
    }

    private fun openApp(context: Context): PendingIntent =
        PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
}
