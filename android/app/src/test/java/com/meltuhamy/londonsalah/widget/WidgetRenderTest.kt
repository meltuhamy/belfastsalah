package com.meltuhamy.londonsalah.widget

import android.graphics.Color
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.meltuhamy.londonsalah.R
import com.meltuhamy.londonsalah.widget.PayloadFixture.AFTER_ISHA
import com.meltuhamy.londonsalah.widget.PayloadFixture.ASR
import com.meltuhamy.londonsalah.widget.PayloadFixture.FAJR
import com.meltuhamy.londonsalah.widget.PayloadFixture.MAGHRIB
import com.meltuhamy.londonsalah.widget.PayloadFixture.ONE_PM
import com.meltuhamy.londonsalah.widget.PayloadFixture.THREE_PM
import com.meltuhamy.londonsalah.widget.WidgetHarness.CELLS
import com.meltuhamy.londonsalah.widget.WidgetHarness.INLINE_COUNTDOWNS
import com.meltuhamy.londonsalah.widget.WidgetHarness.draw
import com.meltuhamy.londonsalah.widget.WidgetHarness.homeScreenSize
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * What each widget shows, and when.
 *
 * Every widget is drawn from a fixed payload at a fixed time, so each
 * expectation here can be worked out from PayloadFixture by hand: at 13:00 on
 * the 15th Asr is next, at 14:01, one hour and one minute away.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = WidgetHarness.PHONE)
class WidgetRenderTest {

    private val timetables = listOf(
        WidgetKind.WIDE, WidgetKind.TALL, WidgetKind.COMPACT, WidgetKind.COLUMN
    )

    /** The widgets with a countdown heading of their own, and its two views. */
    private val headed = listOf(
        Triple(WidgetKind.WIDE, R.id.widget_next_label, R.id.widget_countdown),
        Triple(WidgetKind.TALL, R.id.widget_next_label, R.id.widget_countdown),
        Triple(WidgetKind.TILE, R.id.tile_prayer, R.id.tile_countdown)
    )

    private fun config(countdown: CountdownMode = CountdownMode.SECONDS) =
        WidgetConfig(palette = WidgetPalette.LIGHT, countdown = countdown)

    // --- The timetable -------------------------------------------------------

    @Test
    fun `timetables show the day's own times`() {
        for (kind in timetables) {
            val widget = draw(kind, homeScreenSize(kind))
            val names = WidgetHarness.NAME_VIEWS.getValue(kind).map { widget.text(it) }
            val times = WidgetHarness.TIME_VIEWS.getValue(kind).map { widget.text(it) }
            assertEquals("$kind names", PayloadFixture.NAMES, names)
            assertEquals("$kind times", PayloadFixture.TIMES, times)
        }
    }

    @Test
    fun `after Isha the timetables show tomorrow`() {
        // The day shown is the one the countdown is heading into. Before this,
        // it was whichever day the app was last opened on: a widget left alone
        // kept that date, and times up to a few minutes out, indefinitely.
        for (kind in timetables) {
            val widget = draw(kind, homeScreenSize(kind), nowMillis = AFTER_ISHA)
            val times = WidgetHarness.TIME_VIEWS.getValue(kind).map { widget.text(it) }
            assertEquals("$kind times", PayloadFixture.TOMORROW_TIMES, times)
        }
        for (kind in listOf(WidgetKind.WIDE, WidgetKind.TALL)) {
            val widget = draw(kind, homeScreenSize(kind), nowMillis = AFTER_ISHA)
            assertEquals("$kind date", PayloadFixture.TOMORROW_DATE, widget.text(R.id.widget_date))
        }
    }

    @Test
    fun `timetables highlight the next prayer, and only it`() {
        // Three different cells, including the first: a highlight stuck on the
        // one the layout's sample text marks would pass any one of these.
        val cases = listOf(ONE_PM to ASR, THREE_PM to MAGHRIB, AFTER_ISHA to FAJR)
        for (kind in timetables) {
            for ((now, expected) in cases) {
                val widget = draw(kind, homeScreenSize(kind), nowMillis = now)
                assertEquals(
                    "$kind at ${clock(now)}",
                    listOf(expected),
                    widget.highlighted(CELLS.getValue(kind))
                )
            }
        }
    }

    @Test
    fun `no highlight means none at all`() {
        val plain = WidgetConfig(palette = WidgetPalette.LIGHT, accent = WidgetConfig.NO_ACCENT)
        for (kind in timetables) {
            val widget = draw(kind, homeScreenSize(kind), plain)
            assertEquals("$kind", emptyList<Int>(), widget.highlighted(CELLS.getValue(kind)))
        }
    }

    // --- The countdown -------------------------------------------------------

    @Test
    fun `the countdown reads the time left to the next prayer`() {
        for ((kind, label, countdown) in headed) {
            val widget = draw(kind, homeScreenSize(kind))
            assertEquals("$kind label", "Asr in", widget.text(label))
            assertEquals("$kind countdown", "1:01:00", widget.text(countdown))
        }
    }

    @Test
    fun `after the last prayer it counts down to tomorrow's Fajr`() {
        for ((kind, label, countdown) in headed) {
            val widget = draw(kind, homeScreenSize(kind), nowMillis = AFTER_ISHA)
            assertEquals("$kind label", "Fajr in", widget.text(label))
            // 18:01 to 06:19 the next morning.
            assertEquals("$kind countdown", "12:18:00", widget.text(countdown))
        }
    }

    @Test
    fun `can show the prayer's time instead of a countdown`() {
        for ((kind, label, countdown) in headed) {
            val widget = draw(kind, homeScreenSize(kind), config(CountdownMode.TIME))
            assertEquals("$kind label", "Asr at", widget.text(label))
            assertEquals("$kind time", "14:01", widget.text(countdown))
        }
    }

    @Test
    fun `can hide the countdown`() {
        for ((kind, label, countdown) in headed) {
            val widget = draw(kind, homeScreenSize(kind), config(CountdownMode.NONE))
            assertEquals("$kind label", "Asr", widget.text(label))
            assertFalse("$kind countdown", widget.isShown(countdown))
        }
    }

    @Test
    fun `the one-row and one-column widgets count down inside the next prayer's cell`() {
        for ((kind, countdowns) in INLINE_COUNTDOWNS) {
            val widget = draw(kind, homeScreenSize(kind))
            val shown = countdowns.indices.filter { widget.isShown(countdowns[it]) }
            assertEquals("$kind shows a countdown in", listOf(ASR), shown)
            assertEquals("$kind countdown", "1:01:00", widget.text(countdowns[ASR]))
        }
    }

    @Test
    fun `the one-row and one-column widgets drop the countdown rather than repeat the time`() {
        // The time is already printed in the cell, directly above where the
        // countdown would go - so only the ticking mode earns the line.
        for (mode in listOf(CountdownMode.TIME, CountdownMode.NONE)) {
            for ((kind, countdowns) in INLINE_COUNTDOWNS) {
                val widget = draw(kind, homeScreenSize(kind), config(mode))
                val shown = countdowns.indices.filter { widget.isShown(countdowns[it]) }
                assertEquals("$kind in $mode", emptyList<Int>(), shown)
            }
        }
    }

    // --- City and date -------------------------------------------------------

    @Test
    fun `the city and date can each be hidden`() {
        for (kind in listOf(WidgetKind.WIDE, WidgetKind.TALL)) {
            val size = homeScreenSize(kind)

            val both = draw(kind, size)
            assertEquals("London", both.text(R.id.widget_location))
            assertEquals(PayloadFixture.DATE, both.text(R.id.widget_date))
            assertTrue(both.isShown(R.id.widget_location) && both.isShown(R.id.widget_date))

            val noCity = draw(kind, size, config().copy(showLocation = false))
            assertFalse("$kind city", noCity.isShown(R.id.widget_location))
            assertTrue("$kind date", noCity.isShown(R.id.widget_date))

            val noDate = draw(kind, size, config().copy(showDate = false))
            assertTrue("$kind city", noDate.isShown(R.id.widget_location))
            assertFalse("$kind date", noDate.isShown(R.id.widget_date))
        }

        val big = 170 to 190
        assertTrue(draw(WidgetKind.TILE, big).isShown(R.id.tile_location))
        assertFalse(
            draw(WidgetKind.TILE, big, config().copy(showLocation = false))
                .isShown(R.id.tile_location)
        )
    }

    // --- The tile's sizing ---------------------------------------------------

    @Test
    fun `the tile sizes its text to the space it has`() {
        // The three bands in WidgetRenderer.renderTile, from their smaller side.
        val expected = listOf(
            (70 to 70) to Pair(13f, 9f),
            (100 to 110) to Pair(18f, 12f),
            (170 to 190) to Pair(22f, 14f)
        )
        for ((size, sizes) in expected) {
            val (countdownSp, prayerSp) = sizes
            val tile = draw(WidgetKind.TILE, size)
            assertEquals("countdown at $size", countdownSp, tile.textSizeSp(R.id.tile_countdown), 0.01f)
            assertEquals("prayer at $size", prayerSp, tile.textSizeSp(R.id.tile_prayer), 0.01f)
        }
    }

    @Test
    fun `the tile only names the city when there is room for it`() {
        // Even with the setting on: under 120dp it would be the line that
        // pushes the countdown out.
        assertFalse(draw(WidgetKind.TILE, 100 to 110).isShown(R.id.tile_location))
        assertTrue(draw(WidgetKind.TILE, 170 to 190).isShown(R.id.tile_location))
    }

    // --- Before the app has run ---------------------------------------------

    @Test
    fun `with no times yet, every widget says to open the app`() {
        val hidden = config().copy(showLocation = false, showDate = false)

        for (kind in listOf(WidgetKind.WIDE, WidgetKind.TALL)) {
            val widget = draw(kind, homeScreenSize(kind), hidden, payload = null)
            assertEquals("No times", widget.text(R.id.widget_next_label))
            // Shown although the city is switched off: this line is the only
            // instruction on how to fix it.
            assertTrue(widget.isShown(R.id.widget_location))
            assertEquals("Open the app", widget.text(R.id.widget_location))
            assertFalse(widget.isShown(R.id.widget_date))
        }

        val tile = draw(WidgetKind.TILE, homeScreenSize(WidgetKind.TILE), hidden, payload = null)
        assertEquals("No times", tile.text(R.id.tile_prayer))
        assertTrue(tile.isShown(R.id.tile_location))
        assertEquals("Open the app", tile.text(R.id.tile_location))

        for (kind in listOf(WidgetKind.COMPACT, WidgetKind.COLUMN)) {
            val widget = draw(kind, homeScreenSize(kind), payload = null)
            val names = WidgetHarness.NAME_VIEWS.getValue(kind).map { widget.text(it) }
            assertEquals("$kind names", List(6) { "" }, names)
            assertEquals("$kind highlight", emptyList<Int>(), widget.highlighted(CELLS.getValue(kind)))
        }
    }

    // --- Colours -------------------------------------------------------------

    @Test
    fun `a see-through widget defaults to light text`() {
        // Read against the wallpaper once the background has gone, which is
        // more often dark than not.
        val clear = WidgetConfig(palette = WidgetPalette.LIGHT, opacity = 0)
        val widget = draw(WidgetKind.WIDE, homeScreenSize(WidgetKind.WIDE), clear)
        assertEquals(Color.WHITE, widget.textColor(R.id.widget_countdown))
    }

    // --- The Sky palette -------------------------------------------------------

    private val sky = WidgetConfig(palette = WidgetPalette.SKY)

    @Test
    fun `the sky palette draws the sky behind every widget`() {
        for (kind in WidgetKind.values()) {
            val widget = draw(kind, homeScreenSize(kind), sky)
            assertTrue("$kind", widget.isShown(R.id.sky_background))
            assertTrue("$kind", widget.skyPicture() != null)
        }
    }

    @Test
    fun `other palettes draw no sky`() {
        for (palette in listOf(WidgetPalette.LIGHT, WidgetPalette.DARK, WidgetPalette.SYSTEM)) {
            for (kind in WidgetKind.values()) {
                val widget = draw(kind, homeScreenSize(kind), WidgetConfig(palette = palette))
                assertFalse("$palette $kind", widget.isShown(R.id.sky_background))
            }
        }
    }

    @Test
    fun `the sky takes black text by day and white by night`() {
        // 13:00 is after Duhr, under a midday sky; just after Isha it is dusk.
        for ((kind, _, countdown) in headed) {
            val day = draw(kind, homeScreenSize(kind), sky, nowMillis = ONE_PM)
            assertEquals("$kind by day", Color.BLACK, day.textColor(countdown))
            val night = draw(kind, homeScreenSize(kind), sky, nowMillis = AFTER_ISHA)
            assertEquals("$kind at night", Color.WHITE, night.textColor(countdown))
        }
    }

    @Test
    fun `a mostly see-through sky takes the wallpaper's light text`() {
        // The sky's black-or-white is for the sky. Faded to a fifth, a midday
        // sky shows the wallpaper through it, which is more often dark.
        val faded = sky.copy(opacity = 20)
        for ((kind, _, countdown) in headed) {
            val day = draw(kind, homeScreenSize(kind), faded, nowMillis = ONE_PM)
            assertEquals("$kind", Color.WHITE, day.textColor(countdown))
        }
    }

    @Test
    fun `text on the sky is never faded`() {
        // sky.ts chooses black or white to read at 4.5:1 against the sky, which
        // only holds at full strength.
        val widget = draw(WidgetKind.WIDE, homeScreenSize(WidgetKind.WIDE), sky)
        assertEquals(Color.BLACK, widget.textColor(R.id.widget_next_label))
        assertEquals(Color.BLACK, widget.textColor(R.id.widget_date))
    }

    @Test
    fun `the sky still highlights the next prayer`() {
        for (kind in timetables) {
            val widget = draw(kind, homeScreenSize(kind), sky)
            assertEquals("$kind", listOf(ASR), widget.highlighted(CELLS.getValue(kind)))
        }
    }

    @Test
    fun `the sky's highlight is a solid block with white text, darker by day, lighter at night`() {
        // MEL-370: a frosted pane was hard to find on the gradient. A darker
        // block shows on any sky but night's, where it would all but vanish.
        val cases = listOf(
            ONE_PM to R.drawable.widget_accent_sky_dark,
            PayloadFixture.SUNSET to R.drawable.widget_accent_sky_dark,
            PayloadFixture.LATE_NIGHT to R.drawable.widget_accent_sky_light
        )
        for ((now, drawable) in cases) {
            val sky = WidgetPayload.parse(PayloadFixture.forJan15())!!.skyAt(now)!!
            assertEquals(clock(now), drawable, this.sky.accentDrawable(null, sky))
            for (kind in timetables) {
                val widget = draw(kind, homeScreenSize(kind), this.sky, nowMillis = now)
                val next = widget.highlighted(CELLS.getValue(kind)).single()
                assertEquals(
                    "$kind at ${clock(now)}",
                    Color.WHITE,
                    widget.textColor(WidgetHarness.TIME_VIEWS.getValue(kind)[next])
                )
            }
        }
    }

    @Test
    fun `the timetable and the row grow into a taller launcher's box`() {
        // MEL-370: One UI's 4 x 2 is 221dp tall, half as much again as the
        // 139 the timetable was drawn for, and its text stayed small.
        val design = draw(WidgetKind.WIDE, homeScreenSize(WidgetKind.WIDE))
        val samsung = draw(WidgetKind.WIDE, WidgetHarness.SAMSUNG_WIDE)
        val across = WidgetHarness.SAMSUNG_WIDE.first / 295f
        assertEquals(
            design.textSizeSp(R.id.prayer_time_0) * across,
            samsung.textSizeSp(R.id.prayer_time_0),
            0.05f
        )
        assertTrue(samsung.textSizeSp(R.id.widget_countdown) > design.textSizeSp(R.id.widget_countdown) * across)

        val row = draw(WidgetKind.COMPACT, homeScreenSize(WidgetKind.COMPACT))
        val tallRow = draw(WidgetKind.COMPACT, WidgetHarness.SAMSUNG_COMPACT)
        assertTrue(tallRow.textSizeSp(R.id.compact_time_0) > row.textSizeSp(R.id.compact_time_0) * 1.2f)
    }

    @Test
    fun `growth follows the smaller of the box's two gains, and never shrinks`() {
        assertEquals(WidgetGrowth.NONE, WidgetGrowth.of(WidgetKind.WIDE, 295 to 139))
        assertEquals(WidgetGrowth.NONE, WidgetGrowth.of(WidgetKind.WIDE, null))
        assertEquals(WidgetGrowth.NONE, WidgetGrowth.of(WidgetKind.WIDE, 280 to 139))
        // A Pixel-style 4 x 2, wider but no taller, is left as it was.
        assertEquals(WidgetGrowth.NONE, WidgetGrowth.of(WidgetKind.WIDE, 390 to 139))
        // Samsung's 4 x 2: the row by the width, the heading by the height.
        val samsung = WidgetGrowth.of(WidgetKind.WIDE, WidgetHarness.SAMSUNG_WIDE)
        assertEquals(374 / 295f, samsung.body, 0.001f)
        assertEquals(221 / 139f, samsung.heading, 0.001f)
        // However big, no more than MAX_GROWTH.
        val huge = WidgetGrowth.of(WidgetKind.WIDE, 900 to 600)
        assertEquals(WidgetGrowth.MAX_GROWTH, huge.body)
        assertEquals(WidgetGrowth.MAX_GROWTH, huge.heading)
        // The widgets MEL-370 left alone do not grow.
        assertEquals(WidgetGrowth.NONE, WidgetGrowth.of(WidgetKind.COLUMN, 200 to 600))
        assertEquals(WidgetGrowth.NONE, WidgetGrowth.of(WidgetKind.TALL, 300 to 600))
    }

    @Test
    fun `the sky follows the clock`() {
        // The picture is drawn fresh for each moment: midday and dusk differ.
        val kind = WidgetKind.WIDE
        val day = draw(kind, homeScreenSize(kind), sky, nowMillis = ONE_PM).skyPicture()!!
        val dayTop = day.getPixel(day.width / 2, 1)
        val night = draw(kind, homeScreenSize(kind), sky, nowMillis = AFTER_ISHA).skyPicture()!!
        val nightTop = night.getPixel(night.width / 2, 1)
        assertTrue(Color.blue(dayTop) > Color.blue(nightTop) + 80)
    }

    @Test
    fun `a sky widget with no times asks to be opened, without a sky`() {
        val widget = draw(WidgetKind.WIDE, homeScreenSize(WidgetKind.WIDE), sky, payload = null)
        assertFalse(widget.isShown(R.id.sky_background))
        assertEquals("Open the app", widget.text(R.id.widget_location))
    }

    @Test
    fun `the wide widget keeps the setting sun above the bottom prayer row`() {
        // Wide widgets map the raw [0.24, 0.90] arc onto [0.28, 0.61].
        assertEquals(0.28, SkyPainter.SunArc.WIDE.map(0.24), 1e-6)
        assertEquals(0.61, SkyPainter.SunArc.WIDE.map(0.90), 1e-6)
        assertEquals(0.90, SkyPainter.SunArc.RAW.map(0.90), 1e-6)
        assertEquals(0.24, SkyPainter.SunArc.RAW.map(0.24), 1e-6)

        val sunset = draw(
            WidgetKind.WIDE, homeScreenSize(WidgetKind.WIDE), sky, nowMillis = PayloadFixture.SUNSET
        ).skyPicture()!!
        // At SUNSET (x ≈ 0.93), the sun brightens y ≈ 0.61 relative to the left side of the same row,
        // and no longer sits in the bottom prayer row (y ≈ 0.90). The bloom has no edge, so its
        // faint outer wash still reaches the row, but its bright middle stays above the labels,
        // which start around 75% down.
        val xSun = (sunset.width * 0.93).toInt()
        val xClear = (sunset.width * 0.15).toInt()
        val ySun = (sunset.height * 0.61).toInt()
        val yBottom = (sunset.height * 0.90).toInt()
        fun lift(y: Int) = brightness(sunset.getPixel(xSun, y)) - brightness(sunset.getPixel(xClear, y))
        assertTrue(lift(ySun) > 40)
        assertTrue(lift(yBottom) < lift(ySun) / 4)
    }

    @Test
    fun `the sun grows with the widget, between 26 and 40, and stays small on the narrow ones`() {
        // 12% of the shorter side.
        assertEquals(26f, WidgetRenderer.sunDiameterDp(295, 139, narrow = false))
        assertEquals(26f, WidgetRenderer.sunDiameterDp(77, 87, narrow = false))
        assertEquals(30f, WidgetRenderer.sunDiameterDp(400, 250, narrow = false))
        assertEquals(40f, WidgetRenderer.sunDiameterDp(500, 500, narrow = false))
        assertEquals(20f, WidgetRenderer.sunDiameterDp(292, 79, narrow = true))
        assertEquals(20f, WidgetRenderer.sunDiameterDp(400, 400, narrow = true))
    }

    private fun brightness(pixel: Int): Int = Color.red(pixel) + Color.green(pixel) + Color.blue(pixel)

    private fun clock(millis: Long): String {
        val minutes = (millis / 60_000) % (24 * 60)
        return "%02d:%02d".format(minutes / 60, minutes % 60)
    }
}
