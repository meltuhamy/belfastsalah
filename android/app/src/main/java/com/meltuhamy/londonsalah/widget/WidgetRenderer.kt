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

/** The four arrangements, and the layout each draws into. */
enum class WidgetKind(val layoutId: Int) {
    TILE(R.layout.widget_next_prayer_tile),
    BANNER(R.layout.widget_next_prayer_banner),
    WIDE(R.layout.widget_prayer_times),
    TALL(R.layout.widget_prayer_times_vertical);

    companion object {
        fun forProvider(className: String): WidgetKind = when {
            className.endsWith("NextPrayerTileProvider") -> TILE
            className.endsWith("NextPrayerBannerProvider") -> BANNER
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
            WidgetKind.BANNER -> renderBanner(context, views, config, payload, next)
            else -> renderTimetable(context, views, config, payload, next)
        }
    }

    /**
     * One row: the next prayer, with the countdown small above it.
     *
     * Inverted from the tile on purpose - what is being waited for is the
     * headline here, and the countdown is the detail. Nothing is sized to fit,
     * because a row this shape has no small end worth defending: shrunk
     * horizontally the text simply ellipsises.
     */
    private fun renderBanner(
        context: Context,
        views: RemoteViews,
        config: WidgetConfig,
        payload: WidgetPayload?,
        next: WidgetUpcoming?
    ): RemoteViews {
        views.setOnClickPendingIntent(R.id.banner_root, openApp(context))
        views.setInt(R.id.banner_root, "setBackgroundColor", config.backgroundColor(context))
        views.setTextColor(R.id.banner_countdown, config.secondaryTextColor(context))
        views.setTextColor(R.id.banner_prayer, config.primaryTextColor(context))

        if (payload == null || next == null) {
            views.setTextViewText(
                R.id.banner_prayer, context.getString(R.string.widget_unavailable)
            )
            views.setChronometer(
                R.id.banner_countdown, SystemClock.elapsedRealtime(), null, false
            )
            views.setViewVisibility(R.id.banner_countdown, View.VISIBLE)
            views.setTextViewText(
                R.id.banner_countdown, context.getString(R.string.widget_open_app)
            )
            return views
        }

        // The prayer's name stands alone as the headline, so no "in" or "at" -
        // the line below it already says which it is.
        WidgetCountdown.bind(
            views,
            context,
            config,
            next,
            R.id.banner_countdown,
            R.id.banner_prayer,
            labelWithVerb = false
        )
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
