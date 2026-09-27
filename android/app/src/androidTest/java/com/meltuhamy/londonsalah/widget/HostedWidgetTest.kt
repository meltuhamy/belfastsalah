package com.meltuhamy.londonsalah.widget

import android.appwidget.AppWidgetHost
import android.appwidget.AppWidgetHostView
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.util.TypedValue
import android.view.View
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.action.ViewActions.scrollTo
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.MediumTest
import androidx.test.platform.app.InstrumentationRegistry
import com.meltuhamy.londonsalah.R
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs

/**
 * The widgets as the system runs them, with this test standing in for the
 * launcher.
 *
 * The JVM tests draw the widgets directly. What they cannot reach is
 * everything between a launcher and the renderer: that the manifest and the
 * provider XML describe five widgets the system accepts, that binding one
 * calls its provider, that the provider's RemoteViews reach the host, that a
 * resize comes back through onAppWidgetOptionsChanged, and that saving the
 * configuration screen redraws what is on the home screen. Here the test is
 * the host - an AppWidgetHost, as a launcher would have - so all of that runs
 * for real, on a device, without depending on any particular launcher.
 *
 * `appwidget grantbind` is what lets it: binding widgets normally takes a
 * dialog the user answers, and the shell can grant it outright.
 */
@RunWith(AndroidJUnit4::class)
@MediumTest
class HostedWidgetTest {

    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context: Context = instrumentation.targetContext
    private val manager = AppWidgetManager.getInstance(context)
    private lateinit var host: AppWidgetHost
    private val bound = mutableListOf<Int>()

    /** What the shell said to the grant, for when binding is refused anyway. */
    private var grantOutput = ""

    @Before
    fun hostWidgets() {
        // "current" is what the documentation gives for --user; the explicit
        // id is the same user on a test device, and is there in case a
        // system image reads the flag differently.
        grantOutput = listOf("current", "0").joinToString("\n") { user ->
            val command = "appwidget grantbind --package ${context.packageName} --user $user"
            "$ $command\n" + shell(command).ifBlank { "(no output)" }
        }

        // The device's real clock drives these widgets, so the times are
        // placed relative to it: Asr, at "14:01", due in two hours.
        WidgetStore.write(
            context,
            PayloadFixture.relativeTo(System.currentTimeMillis(), PayloadFixture.ASR)
        )

        onMain {
            host = AppWidgetHost(context, HOST_ID)
            host.startListening()
        }
    }

    @After
    fun removeWidgets() {
        onMain {
            bound.forEach { host.deleteAppWidgetId(it) }
            host.stopListening()
        }
        shell("appwidget revokebind --package ${context.packageName} --user current")
        shell("appwidget revokebind --package ${context.packageName} --user 0")
    }

    @Test
    fun theSystemAcceptsAllFiveWidgets() {
        val providers = manager.getInstalledProvidersForPackage(context.packageName, null)
        assertEquals(
            listOf(
                "NextPrayerTileProvider",
                "PrayerTimesColumnWidgetProvider",
                "PrayerTimesCompactWidgetProvider",
                "PrayerTimesVerticalWidgetProvider",
                "PrayerTimesWidgetProvider"
            ),
            providers.map { it.provider.className.substringAfterLast('.') }.sorted()
        )

        for (info in providers) {
            val name = info.provider.shortClassName
            assertEquals(
                "$name configure",
                ComponentName(context, WidgetConfigActivity::class.java),
                info.configure
            )
            assertNotEquals("$name initialLayout", 0, info.initialLayout)
            assertNotEquals("$name previewLayout", 0, info.previewLayout)
            assertTrue(
                "$name reconfigurable",
                info.widgetFeatures and AppWidgetProviderInfo.WIDGET_FEATURE_RECONFIGURABLE != 0
            )
            // Every one is captioned with the app's name on the home screen,
            // which comes from this label.
            assertEquals("$name label", "Prayer Times", info.loadLabel(context.packageManager))
        }
    }

    @Test
    fun bindingEachWidgetDrawsTheDayIntoIt() {
        val problems = mutableListOf<String>()

        for (case in CASES) {
            val widget = bind(case.provider, case.widthDp, case.heightDp)

            // Waiting for text the layouts do not carry as sample text proves
            // the provider ran: until it does, the host shows the layout as
            // it stands, placeholders and all.
            waitUntil("${case.name} to draw") { widget.text(case.proofId) == case.proof }

            val cells = case.cells
            onMain {
                if (cells != null) {
                    val lit = cells.indices.filter {
                        widget.view.findViewById<View>(cells[it]).background != null
                    }
                    if (lit != listOf(PayloadFixture.ASR)) {
                        problems += "${case.name} highlights $lit, not Asr"
                    }
                }
                widget.layOut(case.widthDp, case.heightDp)
                TextFit.problems(widget.content()).forEach {
                    problems += "${case.name} at ${case.widthDp}x${case.heightDp}dp: $it"
                }
            }
        }

        assertTrue(problems.joinToString("\n"), problems.isEmpty())
    }

    @Test
    fun resizingTheTileRescalesItsText() {
        val tile = bind(NextPrayerTileProvider::class.java, 70, 70)
        waitUntil("the tile to draw") { tile.text(R.id.tile_prayer) == "Asr in" }
        assertEquals(sp(13f), tile.textSize(R.id.tile_countdown), 0.5f)
        assertFalse(onMain { tile.isShown(R.id.tile_location) })

        // What a launcher does when the user drags the handles. It reaches the
        // provider as onAppWidgetOptionsChanged, not onUpdate.
        manager.updateAppWidgetOptions(tile.id, sizeOptions(170, 190))

        waitUntil("the tile to rescale") { abs(tile.textSize(R.id.tile_countdown) - sp(22f)) < 0.5f }
        assertTrue(onMain { tile.isShown(R.id.tile_location) })
        assertEquals("London", tile.text(R.id.tile_location))
    }

    @Test
    fun savingTheAppearanceScreenRedrawsTheWidget() {
        val wide = bind(PrayerTimesWidgetProvider::class.java, 390, 139)
        waitUntil("the widget to draw") { wide.text(R.id.prayer_time_3) == "14:01" }
        assertTrue(onMain { wide.isShown(R.id.widget_location) })

        val intent = Intent(context, WidgetConfigActivity::class.java)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wide.id)
        ActivityScenario.launch<WidgetConfigActivity>(intent).use {
            onView(withId(R.id.show_location)).perform(scrollTo(), click())
            onView(withId(R.id.config_save)).perform(scrollTo(), click())
        }

        assertFalse(WidgetConfig.load(context, wide.id).showLocation)
        waitUntil("the city to go") { !wide.isShown(R.id.widget_location) }
        assertTrue(onMain { wide.isShown(R.id.widget_date) })
    }

    // --- Hosting -------------------------------------------------------------

    private inner class Hosted(val id: Int, val view: AppWidgetHostView) {
        /** The widget's own layout, inside the host's frame. */
        fun content(): View = view.getChildAt(0)

        fun text(viewId: Int): String? =
            onMain { view.findViewById<TextView>(viewId)?.text?.toString() }

        fun textSize(viewId: Int): Float =
            onMain { view.findViewById<TextView>(viewId)?.textSize ?: 0f }

        fun isShown(viewId: Int): Boolean =
            view.findViewById<View>(viewId)?.visibility == View.VISIBLE

        /** Measures and lays out at a size, as a launcher's grid would. */
        fun layOut(widthDp: Int, heightDp: Int) {
            val width = View.MeasureSpec.makeMeasureSpec(px(widthDp), View.MeasureSpec.EXACTLY)
            val height = View.MeasureSpec.makeMeasureSpec(px(heightDp), View.MeasureSpec.EXACTLY)
            view.measure(width, height)
            view.layout(0, 0, view.measuredWidth, view.measuredHeight)
        }
    }

    private fun bind(provider: Class<*>, widthDp: Int, heightDp: Int): Hosted {
        val id = host.allocateAppWidgetId()
        bound += id
        assertTrue(
            "could not bind ${provider.simpleName}. The grant said:\n$grantOutput",
            manager.bindAppWidgetIdIfAllowed(
                id, ComponentName(context, provider), sizeOptions(widthDp, heightDp)
            )
        )
        val view = onMain {
            host.createView(context, id, manager.getAppWidgetInfo(id)).apply {
                // Launchers lay widgets out edge to edge in their cells; the
                // host view's default padding would only shrink the space the
                // tests are checking.
                setPadding(0, 0, 0, 0)
            }
        }
        return Hosted(id, view)
    }

    private fun sizeOptions(widthDp: Int, heightDp: Int) = Bundle().apply {
        putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, widthDp)
        putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, widthDp)
        putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, heightDp)
        putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, heightDp)
    }

    // --- Plumbing ------------------------------------------------------------

    /**
     * Runs `block` on the main thread, where the host delivers its views and
     * the only place they may be touched. Already there, it just runs it:
     * runOnMainSync from the main thread would wait on itself forever.
     */
    private fun <T> onMain(block: () -> T): T {
        if (Looper.myLooper() == Looper.getMainLooper()) return block()
        var result: Result<T>? = null
        instrumentation.runOnMainSync { result = runCatching(block) }
        return result!!.getOrThrow()
    }

    private fun waitUntil(what: String, timeoutMs: Long = 15_000, check: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + timeoutMs
        while (SystemClock.uptimeMillis() < deadline) {
            if (onMain(check)) return
            Thread.sleep(100)
        }
        fail("Timed out after ${timeoutMs}ms waiting for $what")
    }

    /** Runs a shell command as the shell user, and returns what it printed. */
    private fun shell(command: String): String {
        val output: ParcelFileDescriptor = instrumentation.uiAutomation.executeShellCommand(command)
        // Reading to the end is also what waits for the command to finish.
        return ParcelFileDescriptor.AutoCloseInputStream(output).use {
            it.readBytes().toString(Charsets.UTF_8).trim()
        }
    }

    private fun px(dp: Int): Int = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, dp.toFloat(), context.resources.displayMetrics
    ).toInt()

    private fun sp(value: Float): Float = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_SP, value, context.resources.displayMetrics
    )

    /**
     * One widget to bind, at one size, with a piece of text it can only be
     * showing if its provider drew it, and the cells to find the highlight in.
     */
    private class Case(
        val name: String,
        val provider: Class<*>,
        val widthDp: Int,
        val heightDp: Int,
        val proofId: Int,
        val proof: String,
        val cells: IntArray? = null
    )

    private companion object {
        /** Any id will do so long as nothing else on the device uses it. */
        const val HOST_ID = 0x7E57

        val CASES = listOf(
            Case(
                "tile", NextPrayerTileProvider::class.java, 77, 87,
                R.id.tile_prayer, "Asr in"
            ),
            Case(
                "one row", PrayerTimesCompactWidgetProvider::class.java, 292, 79,
                R.id.compact_time_3, "14:01",
                intArrayOf(
                    R.id.compact_col_0, R.id.compact_col_1, R.id.compact_col_2,
                    R.id.compact_col_3, R.id.compact_col_4, R.id.compact_col_5
                )
            ),
            Case(
                "one column", PrayerTimesColumnWidgetProvider::class.java, 62, 225,
                R.id.column_time_3, "14:01",
                intArrayOf(
                    R.id.column_row_0, R.id.column_row_1, R.id.column_row_2,
                    R.id.column_row_3, R.id.column_row_4, R.id.column_row_5
                )
            ),
            Case(
                "wide", PrayerTimesWidgetProvider::class.java, 295, 139,
                R.id.prayer_time_3, "14:01",
                intArrayOf(
                    R.id.prayer_col_0, R.id.prayer_col_1, R.id.prayer_col_2,
                    R.id.prayer_col_3, R.id.prayer_col_4, R.id.prayer_col_5
                )
            ),
            Case(
                "tall", PrayerTimesVerticalWidgetProvider::class.java, 138, 225,
                R.id.prayer_time_3, "14:01",
                intArrayOf(
                    R.id.prayer_col_0, R.id.prayer_col_1, R.id.prayer_col_2,
                    R.id.prayer_col_3, R.id.prayer_col_4, R.id.prayer_col_5
                )
            )
        )
    }
}
