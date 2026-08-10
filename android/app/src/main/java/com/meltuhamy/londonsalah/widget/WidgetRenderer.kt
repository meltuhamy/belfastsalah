package com.meltuhamy.londonsalah.widget

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import com.meltuhamy.londonsalah.MainActivity
import com.meltuhamy.londonsalah.R

/**
 * The five arrangements, and the layout each draws into.
 *
 * WIDE and TALL give the countdown a heading of its own; COMPACT (one row) and
 * COLUMN (one column) have no room for one and put it inside the next prayer's
 * cell instead. TILE is the square next-prayer widget.
 */
enum class WidgetKind(val layoutId: Int) {
    TILE(R.layout.widget_next_prayer_tile),
    COMPACT(R.layout.widget_prayer_times_compact),
    COLUMN(R.layout.widget_prayer_times_column),
    WIDE(R.layout.widget_prayer_times),
    TALL(R.layout.widget_prayer_times_vertical);

    companion object {
        fun forProvider(className: String): WidgetKind = when {
            className.endsWith("NextPrayerTileProvider") -> TILE
            className.endsWith("PrayerTimesCompactWidgetProvider") -> COMPACT
            className.endsWith("PrayerTimesColumnWidgetProvider") -> COLUMN
            className.endsWith("PrayerTimesVerticalWidgetProvider") -> TALL
            else -> WIDE
        }
    }
}

/**
 * Builds the RemoteViews for a widget.
 *
 * Lives apart from the providers so the configuration screen can render a
 * preview through RemoteViews.apply() using this exact code. A preview built
 * from a second, parallel implementation would be a preview of something else
 * - which is the failure mode worth designing out.
 */
object WidgetRenderer {

    private val NAME_IDS = intArrayOf(
        R.id.prayer_name_0, R.id.prayer_name_1, R.id.prayer_name_2,
        R.id.prayer_name_3, R.id.prayer_name_4, R.id.prayer_name_5
    )
    private val TIME_IDS = intArrayOf(
        R.id.prayer_time_0, R.id.prayer_time_1, R.id.prayer_time_2,
        R.id.prayer_time_3, R.id.prayer_time_4, R.id.prayer_time_5
    )
    private val COLUMN_IDS = intArrayOf(
        R.id.prayer_col_0, R.id.prayer_col_1, R.id.prayer_col_2,
        R.id.prayer_col_3, R.id.prayer_col_4, R.id.prayer_col_5
    )

    /**
     * The views the two inline-countdown layouts are drawn through. They differ
     * only in which way the six cells run, so they share a renderer and this
     * says which ids that renderer should reach for.
     */
    private class InlineIds(
        val root: Int,
        val cells: IntArray,
        val names: IntArray,
        val times: IntArray,
        val countdowns: IntArray
    )

    private val COMPACT_IDS = InlineIds(
        root = R.id.compact_root,
        cells = intArrayOf(
            R.id.compact_col_0, R.id.compact_col_1, R.id.compact_col_2,
            R.id.compact_col_3, R.id.compact_col_4, R.id.compact_col_5
        ),
        names = intArrayOf(
            R.id.compact_name_0, R.id.compact_name_1, R.id.compact_name_2,
            R.id.compact_name_3, R.id.compact_name_4, R.id.compact_name_5
        ),
        times = intArrayOf(
            R.id.compact_time_0, R.id.compact_time_1, R.id.compact_time_2,
            R.id.compact_time_3, R.id.compact_time_4, R.id.compact_time_5
        ),
        countdowns = intArrayOf(
            R.id.compact_countdown_0, R.id.compact_countdown_1, R.id.compact_countdown_2,
            R.id.compact_countdown_3, R.id.compact_countdown_4, R.id.compact_countdown_5
        )
    )

    private val COLUMN_IDS_INLINE = InlineIds(
        root = R.id.column_root,
        cells = intArrayOf(
            R.id.column_row_0, R.id.column_row_1, R.id.column_row_2,
            R.id.column_row_3, R.id.column_row_4, R.id.column_row_5
        ),
        names = intArrayOf(
            R.id.column_name_0, R.id.column_name_1, R.id.column_name_2,
            R.id.column_name_3, R.id.column_name_4, R.id.column_name_5
        ),
        times = intArrayOf(
            R.id.column_time_0, R.id.column_time_1, R.id.column_time_2,
            R.id.column_time_3, R.id.column_time_4, R.id.column_time_5
        ),
        countdowns = intArrayOf(
            R.id.column_countdown_0, R.id.column_countdown_1, R.id.column_countdown_2,
            R.id.column_countdown_3, R.id.column_countdown_4, R.id.column_countdown_5
        )
    )

    /** Size in dp of the widget's smaller side, or null when it is not known. */
    fun render(
        context: Context,
        kind: WidgetKind,
        config: WidgetConfig,
        sizeDp: Int? = null
    ): RemoteViews {
        val views = RemoteViews(context.packageName, kind.layoutId)
        val payload = WidgetPayload.parse(WidgetStore.read(context))
        val next = payload?.nextAfter(System.currentTimeMillis())

        return when (kind) {
            WidgetKind.TILE -> renderTile(context, views, config, payload, next, sizeDp)
            WidgetKind.COMPACT ->
                renderInline(context, views, config, payload, next, COMPACT_IDS)
            WidgetKind.COLUMN ->
                renderInline(context, views, config, payload, next, COLUMN_IDS_INLINE)
            else -> renderTimetable(context, views, config, payload, next)
        }
    }

    /**
     * The whole timetable, with no room for a countdown of its own.
     *
     * One row one cell high, or one narrow column - either way there is no
     * header to spare, so the countdown goes inside the next prayer's cell,
     * beneath its time and within the highlight. Only in the ticking mode:
     * showing the prayer's clock time there would repeat the number directly
     * above it, and neither shape can spend a line saying something twice.
     */
    private fun renderInline(
        context: Context,
        views: RemoteViews,
        config: WidgetConfig,
        payload: WidgetPayload?,
        next: WidgetUpcoming?,
        ids: InlineIds
    ): RemoteViews {
        views.setOnClickPendingIntent(ids.root, openApp(context))
        views.setInt(ids.root, "setBackgroundColor", config.backgroundColor(context))

        val primary = config.primaryTextColor(context)
        val secondary = config.secondaryTextColor(context)

        for (i in ids.cells.indices) {
            WidgetCountdown.stopTicking(views, ids.countdowns[i])
            views.setViewVisibility(ids.countdowns[i], View.GONE)

            val prayer = payload?.prayers?.getOrNull(i)
            if (prayer == null) {
                views.setTextViewText(ids.names[i], "")
                views.setTextViewText(ids.times[i], "")
                views.setInt(ids.cells[i], "setBackgroundResource", 0)
                continue
            }

            views.setTextViewText(ids.names[i], prayer.name)
            views.setTextViewText(ids.times[i], prayer.time)

            // Matched by name because that is what both sides agree on: the
            // upcoming list and today's rows come from the same source.
            val isNext = next != null && prayer.name == next.name
            val highlight = if (isNext) config.accentDrawable() else 0
            views.setInt(ids.cells[i], "setBackgroundResource", highlight)

            val onHighlight = highlight != 0
            views.setTextColor(
                ids.names[i],
                if (onHighlight) config.accentTextColor(context) else secondary
            )
            views.setTextColor(
                ids.times[i],
                if (onHighlight) config.accentTextColor(context) else primary
            )

            if (isNext && next != null && config.countdown == CountdownMode.SECONDS) {
                views.setTextColor(
                    ids.countdowns[i],
                    if (onHighlight) config.accentTextColor(context) else secondary
                )
                views.setViewVisibility(ids.countdowns[i], View.VISIBLE)
                WidgetCountdown.startTicking(views, next, ids.countdowns[i])
            }
        }

        return views
    }

    private fun renderTile(
        context: Context,
        views: RemoteViews,
        config: WidgetConfig,
        payload: WidgetPayload?,
        next: WidgetUpcoming?,
        sizeDp: Int?
    ): RemoteViews {
        views.setOnClickPendingIntent(R.id.tile_root, openApp(context))
        views.setInt(R.id.tile_root, "setBackgroundColor", config.backgroundColor(context))
        views.setTextColor(R.id.tile_prayer, config.secondaryTextColor(context))
        views.setTextColor(R.id.tile_countdown, config.primaryTextColor(context))
        views.setTextColor(R.id.tile_location, config.secondaryTextColor(context))

        // RemoteViews has no auto-sizing text before API 31, so a one-cell
        // tile would simply clip "3:27:23". Sized here instead, from whichever
        // side is smaller.
        val size = sizeDp ?: Int.MAX_VALUE
        val (countdownSp, prayerSp, padDp) = when {
            size < 80 -> Triple(13f, 9f, 4)
            size < 120 -> Triple(18f, 12f, 8)
            else -> Triple(22f, 14f, 12)
        }
        views.setTextViewTextSize(R.id.tile_countdown, TypedValue.COMPLEX_UNIT_SP, countdownSp)
        views.setTextViewTextSize(R.id.tile_prayer, TypedValue.COMPLEX_UNIT_SP, prayerSp)
        views.setTextViewTextSize(R.id.tile_location, TypedValue.COMPLEX_UNIT_SP, prayerSp)

        val padPx = (padDp * context.resources.displayMetrics.density).toInt()
        views.setViewPadding(R.id.tile_root, padPx, padPx, padPx, padPx)
        views.setViewVisibility(
            R.id.tile_location,
            if (size < 120) View.GONE else View.VISIBLE
        )

        if (payload == null || next == null) {
            views.setTextViewText(R.id.tile_prayer, context.getString(R.string.widget_unavailable))
            views.setTextViewText(R.id.tile_location, context.getString(R.string.widget_open_app))
            views.setChronometer(R.id.tile_countdown, SystemClock.elapsedRealtime(), null, false)
            views.setTextViewText(R.id.tile_countdown, "")
            return views
        }

        views.setTextViewText(R.id.tile_location, payload.locationLabel)
        WidgetCountdown.bind(views, context, config, next, R.id.tile_countdown, R.id.tile_prayer)
        return views
    }

    private fun renderTimetable(
        context: Context,
        views: RemoteViews,
        config: WidgetConfig,
        payload: WidgetPayload?,
        next: WidgetUpcoming?
    ): RemoteViews {
        views.setOnClickPendingIntent(R.id.widget_root, openApp(context))

        val primary = config.primaryTextColor(context)
        val secondary = config.secondaryTextColor(context)
        views.setInt(R.id.widget_root, "setBackgroundColor", config.backgroundColor(context))
        views.setTextColor(R.id.widget_next_label, secondary)
        views.setTextColor(R.id.widget_countdown, primary)
        views.setTextColor(R.id.widget_location, secondary)
        views.setTextColor(R.id.widget_date, secondary)

        if (payload == null || next == null) {
            views.setTextViewText(
                R.id.widget_next_label, context.getString(R.string.widget_unavailable)
            )
            views.setTextViewText(
                R.id.widget_location, context.getString(R.string.widget_open_app)
            )
            views.setTextViewText(R.id.widget_date, "")
            views.setChronometer(
                R.id.widget_countdown, SystemClock.elapsedRealtime(), null, false
            )
            views.setTextViewText(R.id.widget_countdown, "")
            for (i in COLUMN_IDS.indices) {
                views.setTextViewText(NAME_IDS[i], "")
                views.setTextViewText(TIME_IDS[i], "")
                views.setInt(COLUMN_IDS[i], "setBackgroundResource", 0)
            }
            return views
        }

        views.setTextViewText(R.id.widget_location, payload.locationLabel)
        views.setTextViewText(R.id.widget_date, payload.dateLabel)
        WidgetCountdown.bind(
            views, context, config, next, R.id.widget_countdown, R.id.widget_next_label
        )

        for (i in COLUMN_IDS.indices) {
            val prayer = payload.prayers.getOrNull(i)
            if (prayer == null) {
                views.setTextViewText(NAME_IDS[i], "")
                views.setTextViewText(TIME_IDS[i], "")
                views.setInt(COLUMN_IDS[i], "setBackgroundResource", 0)
                continue
            }

            views.setTextViewText(NAME_IDS[i], prayer.name)
            views.setTextViewText(TIME_IDS[i], prayer.time)

            // Matched by name because that is what both sides agree on: the
            // upcoming list and today's rows come from the same source.
            val highlight =
                if (prayer.name == next.name) config.accentDrawable() else 0
            views.setInt(COLUMN_IDS[i], "setBackgroundResource", highlight)
            val onHighlight = highlight != 0
            views.setTextColor(
                NAME_IDS[i],
                if (onHighlight) config.accentTextColor(context) else secondary
            )
            views.setTextColor(
                TIME_IDS[i],
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
