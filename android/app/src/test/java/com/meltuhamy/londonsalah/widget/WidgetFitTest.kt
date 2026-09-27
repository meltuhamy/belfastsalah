package com.meltuhamy.londonsalah.widget

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.meltuhamy.londonsalah.widget.PayloadFixture.AFTER_ISHA
import com.meltuhamy.londonsalah.widget.PayloadFixture.THREE_PM
import com.meltuhamy.londonsalah.widget.WidgetHarness.draw
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Whether every widget's text is seen in full, at every size it is used at.
 *
 * This is the class of bug the widgets have actually had: a one-cell tile
 * clipping its countdown, a column of rows too tall for its cell. None of it
 * shows up as an error anywhere - the text is simply cut off - so it has to be
 * measured. The widths come from real text layout, which is why these run
 * with Robolectric's native graphics rather than its default stand-in.
 *
 * Every combination is drawn before anything is asserted, so one failing run
 * lists everything that does not fit rather than only the first.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = WidgetHarness.PHONE)
class WidgetFitTest {

    /**
     * The two moments with the most to fit. At 15:00 the next prayer is
     * Maghrib, the longest name, so "Maghrib in" is the widest label. Just
     * after Isha, Fajr is over twelve hours off - "12:18:00", the widest a
     * countdown gets.
     */
    private val worstCases = listOf(THREE_PM to "15:00", AFTER_ISHA to "18:01")

    @Test
    fun `every widget fits its text at every size, time and countdown mode`() {
        val problems = mutableListOf<String>()

        for ((kind, sizes) in WidgetHarness.SIZES) {
            for (size in sizes) {
                for ((now, clock) in worstCases) {
                    for (mode in CountdownMode.values()) {
                        val config = WidgetConfig(palette = WidgetPalette.LIGHT, countdown = mode)
                        val widget = draw(kind, size, config, now)
                        TextFit.problems(widget.root).forEach {
                            problems += "$kind at ${size.first}x${size.second}dp, $clock, $mode: $it"
                        }
                    }
                }
            }
        }

        assertTrue(report(problems), problems.isEmpty())
    }

    @Test
    fun `every widget fits its text before the app has run`() {
        // "No times" and "Open the app" are not the lines the layouts were
        // sized around, and a widget in this state has to be readable more
        // than any other: it is carrying the only instruction there is.
        val problems = mutableListOf<String>()

        for ((kind, sizes) in WidgetHarness.SIZES) {
            for (size in sizes) {
                val widget = draw(kind, size, payload = null)
                TextFit.problems(widget.root).forEach {
                    problems += "$kind at ${size.first}x${size.second}dp, no times: $it"
                }
            }
        }

        assertTrue(report(problems), problems.isEmpty())
    }

    private fun report(problems: List<String>) =
        "${problems.size} piece(s) of text do not fit:\n" + problems.joinToString("\n")
}
