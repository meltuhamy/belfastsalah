package com.meltuhamy.londonsalah.widget

import android.content.Context
import android.content.res.Configuration
import android.util.TypedValue
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.RemoteViews
import android.widget.TextView
import kotlin.math.min

/**
 * How far a widget's text follows the phone's font scale (MEL-105).
 *
 * The layouts size their text in sp, which a launcher scales by the font
 * scale with no limit, and a widget's cell does not grow with it: at the
 * largest size the prayer names and the minutes of the times were cut off.
 * So each widget's text grows with the font scale only as far as its kind has
 * room for, and no further. Each cap is the largest, in steps of 0.05, at
 * which `WidgetFontScaleTest` finds every text fits at every size the widgets
 * are checked at (WidgetHarness.SIZES, plus a Pixel 3a's narrower timetable);
 * a layout change that makes one too generous fails there.
 *
 * The sizes are written onto the RemoteViews in dp, already scaled, so the
 * launcher does not scale them again. The layouts stay in sp, which this reads
 * back as each text's size at a scale of 1.
 */
object WidgetTextScale {

    /**
     * The largest font scale each kind's text follows. The timetables were
     * drawn with little room to spare at a scale of 1, so they have the least
     * to give: the one-cell column's "18:00" runs out of height first, the
     * wide widget's "Maghrib" out of width.
     */
    fun cap(kind: WidgetKind): Float = when (kind) {
        WidgetKind.TILE -> 1.2f
        WidgetKind.COMPACT -> 1.3f
        WidgetKind.COLUMN -> 1.05f
        WidgetKind.WIDE -> 1.05f
        WidgetKind.TALL -> 1.15f
    }

    /** The scale a widget of `kind` draws its text at, on this phone now. */
    fun scale(context: Context, kind: WidgetKind): Float =
        min(context.resources.configuration.fontScale, cap(kind)).coerceAtLeast(MIN_SCALE)

    /**
     * Below 1 too: the smallest system sizes shrink a widget's text as they
     * do the rest of the phone's, but no smaller than this.
     */
    private const val MIN_SCALE = 0.85f

    /** Each kind's text views and their sizes in sp, read from the layout once. */
    private val baseSizes = mutableMapOf<WidgetKind, List<Pair<Int, Float>>>()

    /** Sets every text view in `kind`'s layout to its size at `scale`. */
    fun apply(context: Context, views: RemoteViews, kind: WidgetKind, scale: Float) {
        for ((id, sp) in sizesOf(context, kind)) {
            views.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_DIP, sp * scale)
        }
    }

    private fun sizesOf(context: Context, kind: WidgetKind): List<Pair<Int, Float>> =
        synchronized(baseSizes) {
            baseSizes.getOrPut(kind) {
                // Inflated at a font scale of 1, where sp is plain dp. At any
                // other scale it cannot be divided back out: since Android 14
                // the scaling is non-linear, larger text growing by less.
                val plain = context.createConfigurationContext(
                    Configuration(context.resources.configuration).apply { fontScale = 1f }
                )
                val root = LayoutInflater.from(plain).inflate(kind.layoutId, null)
                val density = plain.resources.displayMetrics.density
                textViews(root)
                    .filter { it.id != View.NO_ID }
                    .map { it.id to it.textSize / density }
            }
        }

    private fun textViews(view: View): List<TextView> = when (view) {
        is TextView -> listOf(view)
        is ViewGroup -> (0 until view.childCount).flatMap { textViews(view.getChildAt(it)) }
        else -> emptyList()
    }
}
