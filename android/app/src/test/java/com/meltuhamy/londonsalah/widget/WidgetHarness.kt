package com.meltuhamy.londonsalah.widget

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import com.meltuhamy.londonsalah.R
import org.robolectric.Robolectric
import org.robolectric.Shadows.shadowOf
import kotlin.math.min

/**
 * Draws widgets the way a launcher does, for the JVM tests to look at.
 *
 * The same path as the configuration screen's preview: WidgetRenderer builds
 * the RemoteViews, and RemoteViews.apply inflates them into real Views. That is
 * also what AppWidgetHostView does with them on a home screen, so what these
 * tests measure is the widget itself rather than a reconstruction of it.
 */
object WidgetHarness {

    /**
     * The Robolectric device every widget test runs on: a phone about the
     * width of the one these widgets were designed on, at a common density.
     */
    const val PHONE = "w411dp-h891dp-xxhdpi"

    /** The timetable as a 4 x 2 on a Galaxy S20 FE (One UI 5), in dp. */
    val SAMSUNG_WIDE = 374 to 221

    /** The one-row widget as a 4 x 1 on the same phone. */
    val SAMSUNG_COMPACT = 374 to 105

    /**
     * The sizes each widget is checked at, in dp.
     *
     * Measured off the home screen the widgets were designed on, where a cell
     * comes out at about 77 x 87dp: the tile as a 1x1 and a 2x2, the row and
     * the wide one at three cells across and four, and the tall ones as
     * placed there. Launchers decide cell sizes, so these are one real phone's
     * rather than any kind of standard.
     *
     * The timetable and the row are also checked in Samsung One UI's taller
     * cells (MEL-370), where they grow (WidgetGrowth): [SAMSUNG_WIDE] and
     * [SAMSUNG_COMPACT], measured off a Galaxy S20 FE's home screen, the
     * timetable made a row taller and the row a row taller, and a narrower
     * phone's 4 x 2.
     */
    val SIZES: Map<WidgetKind, List<Pair<Int, Int>>> = mapOf(
        WidgetKind.TILE to listOf(77 to 87, 170 to 190),
        WidgetKind.COMPACT to listOf(292 to 79, 390 to 79, SAMSUNG_COMPACT, 374 to 221),
        WidgetKind.COLUMN to listOf(62 to 225),
        WidgetKind.WIDE to listOf(295 to 139, 390 to 139, SAMSUNG_WIDE, 374 to 330, 330 to 200),
        WidgetKind.TALL to listOf(138 to 225)
    )

    /** Where each widget is drawn for the screenshots: its size on that phone. */
    fun homeScreenSize(kind: WidgetKind): Pair<Int, Int> = SIZES.getValue(kind).first()

    /** The cells a timetable widget highlights one of, by kind. */
    val CELLS: Map<WidgetKind, IntArray> = mapOf(
        WidgetKind.WIDE to TIMETABLE_CELLS,
        WidgetKind.TALL to TIMETABLE_CELLS,
        WidgetKind.COMPACT to intArrayOf(
            R.id.compact_col_0, R.id.compact_col_1, R.id.compact_col_2,
            R.id.compact_col_3, R.id.compact_col_4, R.id.compact_col_5
        ),
        WidgetKind.COLUMN to intArrayOf(
            R.id.column_row_0, R.id.column_row_1, R.id.column_row_2,
            R.id.column_row_3, R.id.column_row_4, R.id.column_row_5
        )
    )

    val NAME_VIEWS: Map<WidgetKind, IntArray> = mapOf(
        WidgetKind.WIDE to TIMETABLE_NAMES,
        WidgetKind.TALL to TIMETABLE_NAMES,
        WidgetKind.COMPACT to intArrayOf(
            R.id.compact_name_0, R.id.compact_name_1, R.id.compact_name_2,
            R.id.compact_name_3, R.id.compact_name_4, R.id.compact_name_5
        ),
        WidgetKind.COLUMN to intArrayOf(
            R.id.column_name_0, R.id.column_name_1, R.id.column_name_2,
            R.id.column_name_3, R.id.column_name_4, R.id.column_name_5
        )
    )

    val TIME_VIEWS: Map<WidgetKind, IntArray> = mapOf(
        WidgetKind.WIDE to TIMETABLE_TIMES,
        WidgetKind.TALL to TIMETABLE_TIMES,
        WidgetKind.COMPACT to intArrayOf(
            R.id.compact_time_0, R.id.compact_time_1, R.id.compact_time_2,
            R.id.compact_time_3, R.id.compact_time_4, R.id.compact_time_5
        ),
        WidgetKind.COLUMN to intArrayOf(
            R.id.column_time_0, R.id.column_time_1, R.id.column_time_2,
            R.id.column_time_3, R.id.column_time_4, R.id.column_time_5
        )
    )

    /** The one-row and one-column widgets' countdowns, one per cell. */
    val INLINE_COUNTDOWNS: Map<WidgetKind, IntArray> = mapOf(
        WidgetKind.COMPACT to intArrayOf(
            R.id.compact_countdown_0, R.id.compact_countdown_1, R.id.compact_countdown_2,
            R.id.compact_countdown_3, R.id.compact_countdown_4, R.id.compact_countdown_5
        ),
        WidgetKind.COLUMN to intArrayOf(
            R.id.column_countdown_0, R.id.column_countdown_1, R.id.column_countdown_2,
            R.id.column_countdown_3, R.id.column_countdown_4, R.id.column_countdown_5
        )
    )

    /** Roughly a wallpaper, so a see-through widget has something behind it. */
    const val WALLPAPER = 0xFF33475B.toInt()

    /**
     * Writes `payload` where the widgets read it, renders `kind` at the given
     * size and time, and lays it out as a launcher would.
     *
     * `payload` null draws the widget as it is before the app has ever run.
     */
    fun draw(
        kind: WidgetKind,
        size: Pair<Int, Int>,
        config: WidgetConfig = WidgetConfig(palette = WidgetPalette.LIGHT),
        nowMillis: Long = PayloadFixture.ONE_PM,
        payload: String? = PayloadFixture.forJan15()
    ): DrawnWidget {
        WidgetStore.write(ApplicationProvider.getApplicationContext(), payload ?: "")

        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val (widthDp, heightDp) = size

        // The tile sizes its text from the smaller side, as its provider does
        // from the launcher's reported size.
        val views = WidgetRenderer.render(
            activity, kind, config, min(widthDp, heightDp), nowMillis, boxDp = size
        )

        val backdrop = FrameLayout(activity).apply {
            setBackgroundColor(WALLPAPER)
            val pad = dp(activity, 8)
            setPadding(pad, pad, pad, pad)
        }
        val root = views.apply(activity, backdrop)
        backdrop.addView(
            root, FrameLayout.LayoutParams(dp(activity, widthDp), dp(activity, heightDp))
        )

        val screen = FrameLayout(activity)
        screen.addView(
            backdrop,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.TOP or Gravity.START
            )
        )
        activity.setContentView(screen)
        shadowOf(Looper.getMainLooper()).idle()

        return DrawnWidget(root, backdrop)
    }

    fun dp(activity: Activity, value: Int): Int =
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), activity.resources.displayMetrics
        ).toInt()
}

private val TIMETABLE_CELLS = intArrayOf(
    R.id.prayer_col_0, R.id.prayer_col_1, R.id.prayer_col_2,
    R.id.prayer_col_3, R.id.prayer_col_4, R.id.prayer_col_5
)
private val TIMETABLE_NAMES = intArrayOf(
    R.id.prayer_name_0, R.id.prayer_name_1, R.id.prayer_name_2,
    R.id.prayer_name_3, R.id.prayer_name_4, R.id.prayer_name_5
)
private val TIMETABLE_TIMES = intArrayOf(
    R.id.prayer_time_0, R.id.prayer_time_1, R.id.prayer_time_2,
    R.id.prayer_time_3, R.id.prayer_time_4, R.id.prayer_time_5
)

/** A widget after layout, with the questions the tests ask of it. */
class DrawnWidget(val root: View, val backdrop: FrameLayout) {

    fun text(id: Int): String = root.findViewById<TextView>(id).text.toString()

    fun isShown(id: Int): Boolean = root.findViewById<View>(id).visibility == View.VISIBLE

    /** Text size in sp, so it can be compared with the sizes the code sets. */
    fun textSizeSp(id: Int): Float {
        val metrics = root.resources.displayMetrics
        val onePx = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 1f, metrics)
        return root.findViewById<TextView>(id).textSize / onePx
    }

    fun textColor(id: Int): Int = root.findViewById<TextView>(id).currentTextColor

    /** The Sky palette's picture, or null when none was drawn. */
    fun skyPicture(): Bitmap? =
        (root.findViewById<ImageView>(R.id.sky_background).drawable as? BitmapDrawable)?.bitmap

    /** Which of `cells` have a highlight drawn behind them. */
    fun highlighted(cells: IntArray): List<Int> =
        cells.indices.filter { root.findViewById<View>(cells[it]).background != null }
}
