package com.meltuhamy.londonsalah.widget

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.meltuhamy.londonsalah.R
import com.meltuhamy.londonsalah.widget.PayloadFixture.AFTER_ISHA
import com.meltuhamy.londonsalah.widget.PayloadFixture.THREE_PM
import com.meltuhamy.londonsalah.widget.WidgetHarness.draw
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * The widgets at the largest font scale Android offers (MEL-105).
 *
 * Left to sp, every widget's text grew with the font scale and its cell did
 * not: names lost their ends and times their minutes. WidgetTextScale lets the
 * text follow the scale only as far as each kind has room for. This is
 * WidgetFitTest again at 2x, which is what decides those caps, plus a check
 * that the text did grow, so a cap cannot quietly become "never".
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = WidgetHarness.PHONE, fontScale = 2f)
class WidgetFontScaleTest {

    /**
     * Every prayer in turn as the next one. The highlighted column's time is
     * bolder and its countdown sits under it, so which column it is changes
     * what fits beside it: on an emulator's home screen, Duhr's highlight
     * left "Maghrib" two columns along cut to "Maghri". Drawn with the
     * countdown in the cell, the widest the highlight gets.
     */
    private val everyNextPrayer = listOf(
        PayloadFixture.BEFORE_FAJR to "06:05",
        PayloadFixture.BEFORE_SUNRISE to "07:35",
        PayloadFixture.ELEVEN_AM to "11:00",
        PayloadFixture.ONE_PM to "13:00",
        PayloadFixture.SUNSET to "16:30"
    )

    /** WidgetFitTest's two moments with the most to fit, in every mode. */
    private val worstCases = listOf(THREE_PM to "15:00", AFTER_ISHA to "18:01")

    /**
     * The sizes checked: WidgetHarness's, and the timetable as a Pixel 3a
     * emulator's launcher places it, four cells of about 70dp across - the
     * narrowest these widgets have been seen at, where "Maghrib" first ran
     * out of room.
     */
    private val sizes: Map<WidgetKind, List<Pair<Int, Int>>> =
        WidgetHarness.SIZES.mapValues { (kind, sizes) ->
            if (kind == WidgetKind.WIDE) sizes + (280 to 139) else sizes
        }

    private val problems = mutableListOf<String>()

    private fun check(
        kind: WidgetKind,
        size: Pair<Int, Int>,
        now: Long,
        clock: String,
        mode: CountdownMode,
        payload: String
    ) {
        val config = WidgetConfig(palette = WidgetPalette.LIGHT, countdown = mode)
        TextFit.problems(draw(kind, size, config, now, payload).root).forEach {
            problems += "$kind at ${size.first}x${size.second}dp, $clock, $mode: $it"
        }
    }

    private fun assertAllFit() = assertTrue(
        "${problems.size} piece(s) of text do not fit:\n" + problems.joinToString("\n"),
        problems.isEmpty()
    )

    @Test
    fun `every widget fits its text at the largest font scale`() {
        for ((kind, kindSizes) in sizes) {
            for (size in kindSizes) {
                for ((now, clock) in worstCases) {
                    for (mode in CountdownMode.values()) {
                        for (payload in listOf(
                            PayloadFixture.forJan15(), PayloadFixture.forJan15TwelveHour()
                        )) {
                            check(kind, size, now, clock, mode, payload)
                        }
                    }
                }
                TextFit.problems(draw(kind, size, payload = null).root).forEach {
                    problems += "$kind at ${size.first}x${size.second}dp, no times: $it"
                }
            }
        }
        assertAllFit()
    }

    /** With the countdown in the cell, the widest a highlight gets. */
    @Test
    fun `every widget fits with each prayer highlighted in turn`() {
        for ((kind, kindSizes) in sizes) {
            for (size in kindSizes) {
                for ((now, clock) in everyNextPrayer) {
                    check(kind, size, now, clock, CountdownMode.SECONDS, PayloadFixture.forJan15())
                }
            }
        }
        assertAllFit()
    }

    @Test
    fun `the text grows as far as each widget's cap`() {
        // The layouts' own sizes: 11sp names on the timetable, 13sp in the
        // one-row widget. textSizeSp divides by the 2x scale, so a size that
        // followed the scale fully would read 11 and one that ignored it 5.5.
        val wide = draw(WidgetKind.WIDE, WidgetHarness.homeScreenSize(WidgetKind.WIDE))
        assertEquals(
            BASE_TIMETABLE_NAME_SP * WidgetTextScale.cap(WidgetKind.WIDE) / 2f,
            wide.textSizeSp(R.id.prayer_name_0),
            0.05f
        )
        assertTrue(WidgetTextScale.cap(WidgetKind.WIDE) > 1f)

        val compact = draw(WidgetKind.COMPACT, WidgetHarness.homeScreenSize(WidgetKind.COMPACT))
        assertTrue(compact.textSizeSp(R.id.compact_time_0) > BASE_COMPACT_TIME_SP / 2f)
    }

    private companion object {
        const val BASE_TIMETABLE_NAME_SP = 11f
        const val BASE_COMPACT_TIME_SP = 13f
    }
}
