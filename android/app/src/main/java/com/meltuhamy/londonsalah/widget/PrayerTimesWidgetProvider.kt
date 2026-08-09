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
 * The wide widget: a countdown to the next prayer, and the day's six times
 * with the next one picked out.
 *
 * The six columns are fixed views addressed by id rather than a collection.
 * A RemoteViewsService-backed list would be the general answer, but there are
 * always exactly six prayers, and a fixed layout avoids a whole service, an
 * adapter, and their lifecycles for no benefit.
 */
class PrayerTimesWidgetProvider : AppWidgetProvider() {

    private val nameIds = intArrayOf(
        R.id.prayer_name_0, R.id.prayer_name_1, R.id.prayer_name_2,
        R.id.prayer_name_3, R.id.prayer_name_4, R.id.prayer_name_5
    )
    private val timeIds = intArrayOf(
        R.id.prayer_time_0, R.id.prayer_time_1, R.id.prayer_time_2,
        R.id.prayer_time_3, R.id.prayer_time_4, R.id.prayer_time_5
    )
    private val columnIds = intArrayOf(
        R.id.prayer_col_0, R.id.prayer_col_1, R.id.prayer_col_2,
        R.id.prayer_col_3, R.id.prayer_col_4, R.id.prayer_col_5
    )

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
        val views = RemoteViews(context.packageName, R.layout.widget_prayer_times)
        views.setOnClickPendingIntent(R.id.widget_root, openApp(context))

        val payload = WidgetPayload.parse(WidgetStore.read(context))
        val next = payload?.nextAfter(System.currentTimeMillis())

        if (payload == null || next == null) {
            views.setTextViewText(
                R.id.widget_next_label,
                context.getString(R.string.widget_unavailable)
            )
            views.setTextViewText(
                R.id.widget_location,
                context.getString(R.string.widget_open_app)
            )
            views.setTextViewText(R.id.widget_date, "")
            views.setChronometer(
                R.id.widget_countdown, SystemClock.elapsedRealtime(), null, false
            )
            views.setTextViewText(R.id.widget_countdown, "")
            for (i in columnIds.indices) {
                views.setTextViewText(nameIds[i], "")
                views.setTextViewText(timeIds[i], "")
                views.setInt(columnIds[i], "setBackgroundResource", 0)
            }
            return views
        }

        views.setTextViewText(
            R.id.widget_next_label,
            context.getString(R.string.widget_next_in, next.name)
        )
        views.setTextViewText(R.id.widget_location, payload.locationLabel)
        views.setTextViewText(R.id.widget_date, payload.dateLabel)

        // elapsedRealtime timebase, not wall clock.
        val base = SystemClock.elapsedRealtime() + (next.at - System.currentTimeMillis())
        views.setChronometer(R.id.widget_countdown, base, null, true)
        views.setChronometerCountDown(R.id.widget_countdown, true)

        for (i in columnIds.indices) {
            val prayer = payload.prayers.getOrNull(i)
            if (prayer == null) {
                views.setTextViewText(nameIds[i], "")
                views.setTextViewText(timeIds[i], "")
                views.setInt(columnIds[i], "setBackgroundResource", 0)
                continue
            }

            views.setTextViewText(nameIds[i], prayer.name)
            views.setTextViewText(timeIds[i], prayer.time)

            // Matched by name because that is what both sides agree on; the
            // upcoming list and today's rows are built from the same source.
            val isNext = prayer.name == next.name
            views.setInt(
                columnIds[i],
                "setBackgroundResource",
                if (isNext) R.drawable.widget_next_highlight else 0
            )
            views.setTextColor(
                nameIds[i],
                context.getColor(
                    if (isNext) R.color.widget_accent_contrast
                    else R.color.widget_text_secondary
                )
            )
            views.setTextColor(
                timeIds[i],
                context.getColor(
                    if (isNext) R.color.widget_accent_contrast
                    else R.color.widget_text_primary
                )
            )
        }

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
