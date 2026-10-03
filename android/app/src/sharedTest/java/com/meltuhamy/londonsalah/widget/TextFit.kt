package com.meltuhamy.londonsalah.widget

import android.graphics.RectF
import android.text.Layout
import android.view.View
import android.view.ViewGroup
import android.widget.TextView

/**
 * Finds text in a drawn widget that would not be seen in full.
 *
 * Shared by the JVM tests, which draw the widgets through Robolectric, and the
 * device tests, which have a real AppWidgetHost draw them with the device's
 * own fonts. Both hand it the root of the widget's inflated layout.
 */
object TextFit {

    /**
     * Every piece of text in `root` that would not be seen in full, described
     * well enough to fix from a CI log.
     *
     * Three ways text goes missing in a widget, all of them silent:
     * - wider than its view. maxLines=1 without ellipsize drops whatever does
     *   not fit, so "Maghrib in" becomes "Maghrib" and nothing looks broken.
     *   Measured against the whole string on one line, because the view's own
     *   layout has already wrapped it and would report a width that fits.
     * - squeezed shorter than a line, which crops the glyphs top and bottom.
     * - laid out past an ancestor's edge, or into padding that clips, which is
     *   how a column of rows that is too tall loses its last one.
     */
    fun problems(root: View): List<String> {
        val problems = mutableListOf<String>()

        fun name(v: View): String =
            if (v.id != View.NO_ID) v.resources.getResourceEntryName(v.id)
            else v.javaClass.simpleName

        fun visit(v: View) {
            if (v.visibility != View.VISIBLE) return
            if (v is ViewGroup) {
                for (i in 0 until v.childCount) visit(v.getChildAt(i))
                return
            }
            if (v !is TextView || v.text.isNullOrEmpty()) return

            val label = "${name(v)} \"${v.text}\""
            val innerWidth = v.width - v.totalPaddingLeft - v.totalPaddingRight
            val innerHeight = v.height - v.totalPaddingTop - v.totalPaddingBottom

            val wanted = Layout.getDesiredWidth(v.text, v.paint)
            if (wanted > innerWidth + TOLERANCE) {
                problems += "$label needs ${wanted.toInt()}px across, has $innerWidth"
            }
            if (v.lineHeight > innerHeight + TOLERANCE) {
                problems += "$label needs ${v.lineHeight}px down, has $innerHeight"
            }

            // Walk the text's box up to the root, checking it against the part
            // of each ancestor that actually gets drawn.
            val box = RectF(
                v.totalPaddingLeft.toFloat(),
                v.totalPaddingTop.toFloat(),
                (v.width - v.totalPaddingRight).toFloat(),
                (v.height - v.totalPaddingBottom).toFloat()
            )
            var child: View = v
            while (child !== root) {
                val parent = child.parent as? ViewGroup ?: break
                box.offset(
                    (child.left - parent.scrollX).toFloat(),
                    (child.top - parent.scrollY).toFloat()
                )
                val clip = if (parent.clipToPadding) {
                    RectF(
                        parent.paddingLeft.toFloat(),
                        parent.paddingTop.toFloat(),
                        (parent.width - parent.paddingRight).toFloat(),
                        (parent.height - parent.paddingBottom).toFloat()
                    )
                } else {
                    RectF(0f, 0f, parent.width.toFloat(), parent.height.toFloat())
                }
                if (box.left < clip.left - TOLERANCE ||
                    box.top < clip.top - TOLERANCE ||
                    box.right > clip.right + TOLERANCE ||
                    box.bottom > clip.bottom + TOLERANCE
                ) {
                    problems += "$label runs past the edge of ${name(parent)}"
                    break
                }
                child = parent
            }
        }

        visit(root)
        return problems
    }

    /** Half a pixel, for the rounding every layout pass does. */
    private const val TOLERANCE = 0.5f
}
