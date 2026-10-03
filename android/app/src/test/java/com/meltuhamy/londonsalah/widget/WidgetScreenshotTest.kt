package com.meltuhamy.londonsalah.widget

import com.github.takahirom.roborazzi.captureRoboImage
import com.meltuhamy.londonsalah.widget.PayloadFixture.AFTER_ISHA
import com.meltuhamy.londonsalah.widget.PayloadFixture.ONE_PM
import com.meltuhamy.londonsalah.widget.WidgetHarness.draw
import com.meltuhamy.londonsalah.widget.WidgetHarness.homeScreenSize
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Where the reference images live, relative to the app module. */
internal const val SCREENSHOTS = "src/test/screenshots"

/**
 * What every widget looks like, compared against committed reference images.
 *
 *   ./gradlew recordRoborazziDebug   writes them
 *   ./gradlew verifyRoborazziDebug   fails on any difference
 *
 * These catch what the assertions cannot put into words: a colour gone
 * wrong, a highlight drawn in the wrong place, spacing that has drifted. They
 * are Robolectric's rendering rather than a phone's - the fonts and a
 * launcher's corner clipping differ - so they are for noticing change, not
 * for judging how the widgets look on a real home screen.
 *
 * Time and data are fixed, so the same code draws the same pixels every run.
 */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = WidgetHarness.PHONE)
class WidgetScreenshotTest(private val kind: WidgetKind) {

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0}")
        fun kinds(): List<Array<Any>> = WidgetKind.values().map { arrayOf<Any>(it) }
    }

    private val light = WidgetConfig(palette = WidgetPalette.LIGHT)

    private fun shoot(
        name: String,
        config: WidgetConfig,
        nowMillis: Long = ONE_PM,
        payload: String? = PayloadFixture.forJan15()
    ) {
        draw(kind, homeScreenSize(kind), config, nowMillis, payload)
            .backdrop
            .captureRoboImage("$SCREENSHOTS/${kind.name.lowercase()}_$name.png")
    }

    @Test
    fun light() = shoot("light", light)

    @Test
    fun dark() = shoot("dark", WidgetConfig(palette = WidgetPalette.DARK))

    @Test
    fun seeThrough() = shoot("see_through", light.copy(opacity = 0))

    @Test
    fun afterIsha() = shoot("after_isha", light, nowMillis = AFTER_ISHA)

    @Test
    fun noTimes() = shoot("no_times", light, payload = null)
}

/** The settings that change a widget's layout, on the widgets they apply to. */
@RunWith(org.robolectric.RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = WidgetHarness.PHONE)
class WidgetSettingsScreenshotTest {

    private val light = WidgetConfig(palette = WidgetPalette.LIGHT)

    private fun shoot(name: String, kind: WidgetKind, size: Pair<Int, Int>, config: WidgetConfig) {
        draw(kind, size, config).backdrop.captureRoboImage("$SCREENSHOTS/$name.png")
    }

    @Test
    fun prayerTimeInsteadOfCountdown() =
        shoot("wide_prayer_time", WidgetKind.WIDE, 295 to 139, light.copy(countdown = CountdownMode.TIME))

    @Test
    fun noCountdown() =
        shoot("wide_no_countdown", WidgetKind.WIDE, 295 to 139, light.copy(countdown = CountdownMode.NONE))

    @Test
    fun noCityOrDate() =
        shoot("tall_no_city_or_date", WidgetKind.TALL, 138 to 225, light.copy(showLocation = false, showDate = false))

    @Test
    fun noHighlight() =
        shoot("compact_no_highlight", WidgetKind.COMPACT, 292 to 79, light.copy(accent = WidgetConfig.NO_ACCENT))

    @Test
    fun tileAtTwoByTwo() = shoot("tile_2x2", WidgetKind.TILE, 170 to 190, light)

    @Test
    fun tileAtTwoByTwoWithoutCity() =
        shoot("tile_2x2_no_city", WidgetKind.TILE, 170 to 190, light.copy(showLocation = false))
}
