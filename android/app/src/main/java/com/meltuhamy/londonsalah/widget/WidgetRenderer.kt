package com.meltuhamy.londonsalah.widget

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.SystemClock
import android.util.SizeF
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import com.meltuhamy.londonsalah.MainActivity
import com.meltuhamy.londonsalah.R
import kotlin.math.min
import kotlin.math.roundToInt

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

    /**
     * `sizeDp` is the widget's smaller side, or null when it is not known.
     *
     * `nowMillis` decides which prayer is next and what the countdown reads.
     * Everything in the app passes nothing and gets the real clock; tests pin
     * it, which is what makes a rendered widget the same on every run.
     *
     * `boxDp` is the widget's width and height, for the Sky palette's picture
     * to be drawn in the right proportions. Null draws it in the kind's usual
     * shape, cropped to fit.
     *
     * `pictures` is how many of these go to the launcher together
     * ([renderPlaced]), which share the Sky pictures' budget.
     */
    fun render(
        context: Context,
        kind: WidgetKind,
        config: WidgetConfig,
        sizeDp: Int? = null,
        nowMillis: Long = System.currentTimeMillis(),
        boxDp: Pair<Int, Int>? = null,
        pictures: Int = 1
    ): RemoteViews {
        val views = RemoteViews(context.packageName, kind.layoutId)
        val payload = WidgetPayload.parse(WidgetStore.read(context))
        val next = payload?.nextAfter(nowMillis)
        val day = if (payload != null && next != null) payload.dayOf(next) else null
        val sky =
            if (config.palette == WidgetPalette.SKY && next != null) payload?.skyAt(nowMillis)
            else null

        paintSky(context, views, kind, config, sky, boxDp, pictures)

        // The font scale, as far as this kind has room for (WidgetTextScale),
        // and then as far as the launcher's box is bigger than the one the
        // layout was drawn for (WidgetGrowth) - a Samsung 4 x 2 is half as tall
        // again as the design's.
        // In a box smaller than the design's, the font scale only goes as far
        // as the design box's cap shrunk to fit it (WidgetGrowth.room).
        val growth = WidgetGrowth.of(kind, boxDp)
        val textScale = WidgetTextScale.scale(context, kind)
            .let { if (growth.room < 1f) min(it, WidgetTextScale.cap(kind) * growth.room) else it }
        WidgetTextScale.apply(context, views, kind) { id ->
            textScale * (if (id in HEADING_IDS) growth.heading else growth.body)
        }
        spaceOut(context, views, kind, growth.body * growth.room)

        return when (kind) {
            WidgetKind.TILE ->
                renderTile(
                    context, views, config, sky, payload, next, sizeDp, nowMillis, textScale
                )
            WidgetKind.COMPACT ->
                renderInline(context, views, config, sky, day, next, COMPACT_IDS, nowMillis)
            WidgetKind.COLUMN ->
                renderInline(context, views, config, sky, day, next, COLUMN_IDS_INLINE, nowMillis)
            else -> renderTimetable(context, views, config, sky, payload, day, next, nowMillis)
        }
    }

    /**
     * A placed widget, drawn for each box its launcher may show it in
     * (WidgetBoxes), for the launcher to pick from as it turns or unfolds.
     * The tile's text is sized from each box's smaller side.
     */
    fun renderPlaced(
        context: Context,
        kind: WidgetKind,
        config: WidgetConfig,
        boxes: WidgetBoxes,
        nowMillis: Long = System.currentTimeMillis()
    ): RemoteViews {
        val pictures = boxes.all.size.coerceAtLeast(1)
        fun at(box: Pair<Int, Int>?) = render(
            context, kind, config, box?.let { min(it.first, it.second) }, nowMillis, box, pictures
        )
        return when (boxes) {
            is WidgetBoxes.Sized ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    RemoteViews(
                        boxes.boxes.associate { box ->
                            SizeF(box.first.toFloat(), box.second.toFloat()) to at(box)
                        }
                    )
                } else {
                    at(boxes.boxes.first())
                }
            is WidgetBoxes.Oriented -> RemoteViews(at(boxes.landscape), at(boxes.portrait))
            is WidgetBoxes.Single -> at(boxes.box)
        }
    }

    /** The timetable's heading, which may grow further than its row. */
    private val HEADING_IDS = setOf(
        R.id.widget_next_label, R.id.widget_countdown, R.id.widget_location, R.id.widget_date
    )

    /**
     * The padding the layouts were drawn with, grown with their text so that
     * a bigger box is filled in proportion rather than only its text growing.
     * The values are the layouts' own, in dp; keep them in step.
     */
    private fun spaceOut(context: Context, views: RemoteViews, kind: WidgetKind, growth: Float) {
        val density = context.resources.displayMetrics.density
        fun px(dp: Float) = (dp * growth * density).roundToInt()
        when (kind) {
            WidgetKind.WIDE -> {
                val pad = px(12f)
                views.setViewPadding(R.id.widget_root, pad, pad, pad, pad)
                views.setViewPadding(R.id.widget_row, 0, px(10f), 0, 0)
                for (cell in COLUMN_IDS) views.setViewPadding(cell, 0, px(6f), 0, px(6f))
            }
            WidgetKind.COMPACT -> {
                views.setViewPadding(R.id.compact_root, px(6f), px(4f), px(6f), px(4f))
                for (cell in COMPACT_IDS.cells) views.setViewPadding(cell, 0, px(4f), 0, px(4f))
            }
            else -> Unit
        }
    }

    /** A kind's usual shape on a phone, for when the launcher has not said. */
    private fun usualBoxDp(kind: WidgetKind): Pair<Int, Int> = when (kind) {
        WidgetKind.TILE -> 160 to 160
        WidgetKind.COMPACT -> 320 to 80
        WidgetKind.COLUMN -> 80 to 300
        WidgetKind.WIDE -> 320 to 150
        WidgetKind.TALL -> 150 to 300
    }

    /**
     * The Sky palette's picture behind the content, or nothing for every
     * other palette - and for a Sky widget with no times, which shows the
     * dark palette's plain background while it asks to be opened.
     */
    private fun paintSky(
        context: Context,
        views: RemoteViews,
        kind: WidgetKind,
        config: WidgetConfig,
        sky: SkyState?,
        boxDp: Pair<Int, Int>?,
        pictures: Int
    ) {
        if (sky == null) {
            views.setViewVisibility(R.id.sky_background, View.GONE)
            return
        }
        val (widthDp, heightDp) = boxDp ?: usualBoxDp(kind)
        val narrow = kind == WidgetKind.COMPACT || kind == WidgetKind.COLUMN
        views.setImageViewBitmap(
            R.id.sky_background,
            SkyPainter.paint(
                sky,
                widthDp,
                heightDp,
                context.resources.displayMetrics.density,
                sunDp = sunDiameterDp(widthDp, heightDp, narrow),
                sunArc = if (kind == WidgetKind.WIDE) SkyPainter.SunArc.WIDE else SkyPainter.SunArc.RAW,
                maxPixels = SkyPainter.MAX_PIXELS / pictures.coerceAtLeast(1)
            )
        )
        views.setInt(R.id.sky_background, "setImageAlpha", config.alpha())
        views.setViewVisibility(R.id.sky_background, View.VISIBLE)
    }

    /**
     * The sun's diameter on a widget: 12% of its shorter side, from 26dp up to
     * the card's 40, so it is not lost on a widget stretched large. The
     * narrow ones, one row and one column, keep their 20.
     */
    internal fun sunDiameterDp(widthDp: Int, heightDp: Int, narrow: Boolean): Float =
        if (narrow) 20f
        else (0.12 * min(widthDp, heightDp)).roundToInt().coerceIn(26, 40).toFloat()

    /**
     * The app fades every strip cell but the next prayer to 0.6, name and time
     * together (PrayerDayCard.css). RemoteViews cannot set a view's alpha, so
     * the widget composes the same 0.6 into each cell's two text colours. The
     * Sky palette's black or white is kept underneath it rather than replaced.
     */
    internal fun stripTextColor(color: Int, isNext: Boolean): Int =
        if (isNext) color
        else (color and 0x00FFFFFF) or ((Color.alpha(color) * 0.6f).roundToInt() shl 24)

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
        sky: SkyState?,
        day: WidgetDay?,
        next: WidgetUpcoming?,
        ids: InlineIds,
        nowMillis: Long
    ): RemoteViews {
        views.setOnClickPendingIntent(ids.root, openApp(context))
        views.setInt(ids.root, "setBackgroundColor", config.backgroundColor(context, sky))

        val primary = config.primaryTextColor(context, sky)
        val secondary = config.secondaryTextColor(context, sky)
        val onAccent = config.accentTextColor(context, sky)

        for (i in ids.cells.indices) {
            WidgetCountdown.stopTicking(views, ids.countdowns[i])
            views.setViewVisibility(ids.countdowns[i], View.GONE)

            val prayer = day?.prayers?.getOrNull(i)
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
            val highlight = if (isNext) config.accentDrawable(context, sky) else 0
            views.setInt(ids.cells[i], "setBackgroundResource", highlight)

            val onHighlight = highlight != 0
            views.setTextColor(
                ids.names[i],
                stripTextColor(if (onHighlight) onAccent else secondary, isNext)
            )
            views.setTextColor(
                ids.times[i],
                stripTextColor(if (onHighlight) onAccent else primary, isNext)
            )

            if (isNext && next != null && config.countdown == CountdownMode.SECONDS) {
                views.setTextColor(
                    ids.countdowns[i],
                    if (onHighlight) onAccent else secondary
                )
                views.setViewVisibility(ids.countdowns[i], View.VISIBLE)
                WidgetCountdown.startTicking(views, next, ids.countdowns[i], nowMillis)
            }
        }

        return views
    }

    private fun renderTile(
        context: Context,
        views: RemoteViews,
        config: WidgetConfig,
        sky: SkyState?,
        payload: WidgetPayload?,
        next: WidgetUpcoming?,
        sizeDp: Int?,
        nowMillis: Long,
        textScale: Float
    ): RemoteViews {
        views.setOnClickPendingIntent(R.id.tile_root, openApp(context))
        views.setInt(R.id.tile_root, "setBackgroundColor", config.backgroundColor(context, sky))
        views.setTextColor(R.id.tile_prayer, config.secondaryTextColor(context, sky))
        views.setTextColor(R.id.tile_countdown, config.primaryTextColor(context, sky))
        views.setTextColor(R.id.tile_location, config.secondaryTextColor(context, sky))

        // RemoteViews has no auto-sizing text before API 31, so a one-cell
        // tile would simply clip "3:27:23". Sized here instead, from whichever
        // side is smaller.
        val size = sizeDp ?: Int.MAX_VALUE
        val (countdownSp, prayerSp, padDp) = when {
            size < 80 -> Triple(13f, 9f, 4)
            size < 120 -> Triple(18f, 12f, 8)
            else -> Triple(22f, 14f, 12)
        }
        // In dp, already scaled by as much of the font scale as fits
        // (WidgetTextScale), so the launcher does not scale them again.
        val dip = TypedValue.COMPLEX_UNIT_DIP
        views.setTextViewTextSize(R.id.tile_countdown, dip, countdownSp * textScale)
        views.setTextViewTextSize(R.id.tile_prayer, dip, prayerSp * textScale)
        views.setTextViewTextSize(R.id.tile_location, dip, prayerSp * textScale)

        val padPx = (padDp * context.resources.displayMetrics.density).toInt()
        views.setViewPadding(R.id.tile_root, padPx, padPx, padPx, padPx)
        views.setViewVisibility(
            R.id.tile_location,
            if (size < 120 || !config.showLocation) View.GONE else View.VISIBLE
        )

        if (payload == null || next == null) {
            views.setTextViewText(R.id.tile_prayer, context.getString(R.string.widget_unavailable))
            // Shown whatever the setting says: this line is carrying the only
            // instruction on how to fix an empty widget, not the location.
            views.setViewVisibility(R.id.tile_location, View.VISIBLE)
            views.setTextViewText(R.id.tile_location, context.getString(R.string.widget_open_app))
            views.setChronometer(R.id.tile_countdown, SystemClock.elapsedRealtime(), null, false)
            views.setTextViewText(R.id.tile_countdown, "")
            return views
        }

        views.setTextViewText(R.id.tile_location, payload.locationLabel)
        WidgetCountdown.bind(
            views, context, config, next, R.id.tile_countdown, R.id.tile_prayer, nowMillis
        )
        return views
    }

    private fun renderTimetable(
        context: Context,
        views: RemoteViews,
        config: WidgetConfig,
        sky: SkyState?,
        payload: WidgetPayload?,
        day: WidgetDay?,
        next: WidgetUpcoming?,
        nowMillis: Long
    ): RemoteViews {
        views.setOnClickPendingIntent(R.id.widget_root, openApp(context))

        val primary = config.primaryTextColor(context, sky)
        val secondary = config.secondaryTextColor(context, sky)
        val onAccent = config.accentTextColor(context, sky)
        views.setInt(R.id.widget_root, "setBackgroundColor", config.backgroundColor(context, sky))
        views.setTextColor(R.id.widget_next_label, secondary)
        views.setTextColor(R.id.widget_countdown, primary)
        views.setTextColor(R.id.widget_location, secondary)
        views.setTextColor(R.id.widget_date, secondary)

        if (payload == null || day == null || next == null) {
            views.setTextViewText(
                R.id.widget_next_label, context.getString(R.string.widget_unavailable)
            )
            // Shown whatever the setting says: this line is carrying the only
            // instruction on how to fix an empty widget, not the location.
            views.setViewVisibility(R.id.widget_location, View.VISIBLE)
            views.setTextViewText(
                R.id.widget_location, context.getString(R.string.widget_open_app)
            )
            views.setViewVisibility(R.id.widget_date, View.GONE)
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

        views.setViewVisibility(
            R.id.widget_location,
            if (config.showLocation) View.VISIBLE else View.GONE
        )
        views.setViewVisibility(
            R.id.widget_date,
            if (config.showDate) View.VISIBLE else View.GONE
        )
        views.setTextViewText(R.id.widget_location, payload.locationLabel)
        views.setTextViewText(R.id.widget_date, day.dateLabel)
        WidgetCountdown.bind(
            views,
            context,
            config,
            next,
            R.id.widget_countdown,
            R.id.widget_next_label,
            nowMillis
        )

        for (i in COLUMN_IDS.indices) {
            val prayer = day.prayers.getOrNull(i)
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
            val isNext = prayer.name == next.name
            val highlight = if (isNext) config.accentDrawable(context, sky) else 0
            views.setInt(COLUMN_IDS[i], "setBackgroundResource", highlight)
            val onHighlight = highlight != 0
            views.setTextColor(
                NAME_IDS[i],
                stripTextColor(if (onHighlight) onAccent else secondary, isNext)
            )
            views.setTextColor(
                TIME_IDS[i],
                stripTextColor(if (onHighlight) onAccent else primary, isNext)
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
