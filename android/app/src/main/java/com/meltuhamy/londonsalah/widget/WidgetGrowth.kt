package com.meltuhamy.londonsalah.widget

import kotlin.math.min

/**
 * How much bigger than the box it was drawn for a widget has been placed
 * (MEL-370), as factors its text and spacing are multiplied by.
 *
 * The timetable and one-row widgets were laid out on a launcher whose cells are
 * about 77 x 87dp. Samsung's One UI gives the same 4 x 2 and 4 x 1 a box about
 * 374 x 221 and 374 x 105dp, and with fixed sizes the text stayed small in a
 * box with a wide empty band across it. So both grow with the box: everything
 * at once, text and padding, by the same factor - which is what keeps them
 * fitting. A layout that fits its design box fits that box scaled by any
 * factor no bigger than both the width's and the height's own, so the font
 * scale caps (WidgetTextScale) still hold.
 *
 * The timetable's heading has more room across than the six columns under it
 * (the countdown and the city share a whole row), so it may follow the height
 * further than the row does - but only [HEADING_ROOM] further than the width.
 *
 * Only the widgets with a design box here grow. The column, tall and tile
 * widgets are out of MEL-370's scope; the tile sizes itself already.
 */
data class WidgetGrowth(
    /** The prayer row: its text, the cells' padding and the widget's own. */
    val body: Float,
    /** The timetable's heading - countdown, label, city and date. */
    val heading: Float
) {
    companion object {
        val NONE = WidgetGrowth(1f, 1f)

        /**
         * The box each kind was laid out for: the sizes the reference
         * screenshots are taken at (WidgetHarness.SIZES), on the phone the
         * widgets were designed on.
         */
        internal fun designBoxDp(kind: WidgetKind): Pair<Int, Int>? = when (kind) {
            WidgetKind.WIDE -> 295 to 139
            WidgetKind.COMPACT -> 292 to 79
            else -> null
        }

        /**
         * No bigger than this, however large the widget is made: the text is
         * for a glance, and past it a big widget is better spent on sky.
         */
        internal const val MAX_GROWTH = 1.6f

        /**
         * How much further than the width the heading may grow. At the design
         * width its two halves leave about 40% of the row free between them;
         * this spends a little over half of it, so that "Istanbul" and a
         * 12-hour countdown still clear each other at the largest font scale.
         */
        internal const val HEADING_ROOM = 1.2f

        /** `boxDp` is the widget's width and height, or null when unknown. */
        fun of(kind: WidgetKind, boxDp: Pair<Int, Int>?): WidgetGrowth {
            val design = designBoxDp(kind) ?: return NONE
            val (widthDp, heightDp) = boxDp ?: return NONE
            val across = widthDp.toFloat() / design.first
            val down = heightDp.toFloat() / design.second
            val body = min(min(across, down), MAX_GROWTH).coerceAtLeast(1f)
            val heading = min(min(down, across * HEADING_ROOM), MAX_GROWTH).coerceAtLeast(body)
            return WidgetGrowth(body, heading)
        }
    }
}
