package com.meltuhamy.londonsalah.widget

import android.appwidget.AppWidgetManager
import android.os.Bundle
import kotlin.math.abs

/**
 * The boxes a launcher may show a placed widget in, each drawn for separately
 * so that the widget fits whichever one it is in.
 *
 * A launcher works out a widget's size for every orientation (and, on a
 * foldable, every screen) up front, whether or not its home screen ever turns.
 * The Pixel launcher's 4 x 1 is 396 x 117dp upright but 706 x 65dp on its
 * side. Drawn once, for the upright box, a widget that grows with its box
 * (WidgetGrowth) is too tall for the other: turned, the 4 x 2 lost its whole
 * row of times. Taking the smallest of the boxes instead would cost the
 * growth everywhere, Samsung's portrait-only 374 x 221 included, since those
 * launchers report a landscape box too.
 *
 * So the widget is drawn once per box and the launcher picks: on Android 12
 * and later from OPTION_APPWIDGET_SIZES, the sizes it reported; before that
 * as a portrait and a landscape layout, which is all the system can choose
 * between there.
 */
sealed class WidgetBoxes {
    /** Every box, for logging. */
    abstract val all: List<Pair<Int, Int>>

    /** Android 12 on, with more than one distinct size reported. */
    data class Sized(val boxes: List<Pair<Int, Int>>) : WidgetBoxes() {
        override val all get() = boxes
    }

    /** Before 12, or no list reported: upright and turned differ. */
    data class Oriented(
        val portrait: Pair<Int, Int>,
        val landscape: Pair<Int, Int>
    ) : WidgetBoxes() {
        override val all get() = listOf(portrait, landscape)
    }

    /** One box, or none known (null). */
    data class Single(val box: Pair<Int, Int>?) : WidgetBoxes() {
        override val all get() = listOf(box).filterNotNull()
    }

    companion object {
        /**
         * Boxes within this many dp of each other are drawn once, at the
         * smaller, which fits both. The Pixel launcher reports 396 x 116 and
         * 396 x 117 for the same widget, and each box drawn is another Sky
         * picture in a transaction capped at about 1MB.
         */
        internal const val NEAR_DP = 4

        /**
         * The most boxes drawn, again for the transaction's sake: the Sky
         * pictures share one budget (SkyPainter.MAX_PIXELS). The system allows
         * sixteen.
         */
        internal const val MAX_BOXES = 4

        fun of(options: Bundle?): WidgetBoxes {
            fun int(key: String) = options?.getInt(key, 0) ?: 0
            return of(
                minWidth = int(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH),
                minHeight = int(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT),
                maxWidth = int(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH),
                maxHeight = int(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT),
                reported = reportedSizes(options)
            )
        }

        /** `reported` is OPTION_APPWIDGET_SIZES, or null before Android 12. */
        internal fun of(
            minWidth: Int,
            minHeight: Int,
            maxWidth: Int,
            maxHeight: Int,
            reported: List<Pair<Int, Int>>?
        ): WidgetBoxes {
            if (reported != null) {
                val boxes = distinct(reported)
                return if (boxes.size > 1) Sized(boxes) else Single(boxes.single())
            }
            // In portrait a widget is about its minimum width and maximum
            // height; on its side, its maximum width and minimum height.
            val portrait = (minWidth to maxHeight).takeIf { minWidth > 0 && maxHeight > 0 }
            val landscape = (maxWidth to minHeight).takeIf { maxWidth > 0 && minHeight > 0 }
            return when {
                portrait == null -> Single(landscape)
                landscape == null || near(portrait, landscape) -> Single(portrait)
                else -> Oriented(portrait, landscape)
            }
        }

        /**
         * Near-duplicates folded into the smaller, at most [MAX_BOXES] of
         * them. If a launcher reports more than that, the smallest are kept:
         * the launcher shows the largest box that fits, or the smallest when
         * none does, and a smaller box always fits a bigger space.
         */
        internal fun distinct(boxes: List<Pair<Int, Int>>): List<Pair<Int, Int>> {
            val kept = mutableListOf<Pair<Int, Int>>()
            for (box in boxes.sortedWith(compareBy({ it.first * it.second }, { it.first }))) {
                val i = kept.indexOfFirst { near(it, box) }
                if (i < 0) kept += box
                else kept[i] = minOf(kept[i].first, box.first) to minOf(kept[i].second, box.second)
            }
            return kept.take(MAX_BOXES)
        }

        private fun near(a: Pair<Int, Int>, b: Pair<Int, Int>) =
            abs(a.first - b.first) <= NEAR_DP && abs(a.second - b.second) <= NEAR_DP
    }
}
