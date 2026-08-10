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
 * A countdown to the next prayer, and the day's six times with the next one
 * picked out. Subclasses only choose a layout: the wide and vertical
 * arrangements declare the same view ids, so this binds either.
 *
 * The six prayers are fixed views addressed by id rather than a collection.
 * A RemoteViewsService-backed list would be the general answer, but there are
 * always exactly six prayers, and a fixed layout avoids a whole service, an
 * adapter, and their lifecycles for no benefit.
 */
abstract class PrayerTimesWidgetBase : AppWidgetProvider() {

    /** The arrangement this provider draws. */
    protected abstract val layoutId: Int

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
            appWidgetManager.updateAppWidget(id, buildViews(context, id))
        }
        WidgetAlarms.scheduleNextBoundary(context)
    }

    override fun onEnabled(context: Context) {
        WidgetAlarms.scheduleNextBoundary(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        WidgetConfig.delete(context, appWidgetIds)
    }

    private fun buildViews(context: Context, appWidgetId: Int): RemoteViews {
        val views = RemoteViews(context.packageName, layoutId)
        views.setOnClickPendingIntent(R.id.widget_root, openApp(context))

        val config = WidgetConfig.load(context, appWidgetId)
        val primary = config.primaryTextColor(context)
        val secondary = config.secondaryTextColor(context)
        views.setInt(R.id.widget_root, "setBackgroundColor", config.backgroundColor(context))
        views.setTextColor(R.id.widget_next_label, secondary)
        views.setTextColor(R.id.widget_countdown, primary)
        views.setTextColor(R.id.widget_location, secondary)
        views.setTextColor(R.id.widget_date, secondary)

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

        views.setTextViewText(R.id.widget_location, payload.locationLabel)
        views.setTextViewText(R.id.widget_date, payload.dateLabel)
        WidgetCountdown.bind(
            views, context, config, next, R.id.widget_countdown, R.id.widget_next_label
        )

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
            val highlight = if (isNext) config.accentDrawable() else 0
            views.setInt(columnIds[i], "setBackgroundResource", highlight)
            val onHighlight = highlight != 0
            views.setTextColor(
                nameIds[i],
                if (onHighlight) config.accentTextColor(context) else secondary
            )
            views.setTextColor(
                timeIds[i],
                if (onHighlight) config.accentTextColor(context) else primary
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

/** Four cells wide: the six prayers in a row under the countdown. */
class PrayerTimesWidgetProvider : PrayerTimesWidgetBase() {
    override val layoutId = R.layout.widget_prayer_times
}

/** Two cells wide and tall: the same information stacked. */
class PrayerTimesVerticalWidgetProvider : PrayerTimesWidgetBase() {
    override val layoutId = R.layout.widget_prayer_times_vertical
}
