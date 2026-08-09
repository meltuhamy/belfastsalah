package com.meltuhamy.londonsalah.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.SystemClock
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
            appWidgetManager.updateAppWidget(id, buildViews(context))
        }
        WidgetAlarms.scheduleNextBoundary(context)
    }

    override fun onEnabled(context: Context) {
        WidgetAlarms.scheduleNextBoundary(context)
    }

    private fun buildViews(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_next_prayer_tile)
        views.setOnClickPendingIntent(R.id.tile_root, openApp(context))

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

        views.setTextViewText(R.id.tile_prayer, next.name)
        views.setTextViewText(R.id.tile_location, payload.locationLabel)

        // Chronometer counts in the elapsedRealtime timebase, not wall clock,
        // so the target instant has to be converted into it.
        val base = SystemClock.elapsedRealtime() + (next.at - System.currentTimeMillis())
        views.setChronometer(R.id.tile_countdown, base, null, true)
        views.setChronometerCountDown(R.id.tile_countdown, true)

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
