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

    // The Sky palette through the day: Fajr's thread in its haze, the dawn
    // glow before sunrise, a midday sky with the sun high, the sun setting
    // into the horizon, and stars after Isha.
    private val sky = WidgetConfig(palette = WidgetPalette.SKY)

    @Test
    fun skyBeforeFajr() = shoot("sky_before_fajr", sky, nowMillis = PayloadFixture.BEFORE_FAJR)

    @Test
    fun skyBeforeSunrise() = shoot("sky_before_sunrise", sky, nowMillis = PayloadFixture.BEFORE_SUNRISE)

    @Test
    fun skyMidday() = shoot("sky_midday", sky)

    @Test
    fun skySunset() = shoot("sky_sunset", sky, nowMillis = PayloadFixture.SUNSET)

    @Test
    fun skyAfterIsha() = shoot("sky_after_isha", sky, nowMillis = AFTER_ISHA)
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

    // Samsung One UI's taller cells (MEL-370): the timetable and the row grow
    // to fill them, and the Sky highlight is a solid block at every hour - a
    // darker one by day and at dusk, a lighter one at night.
    private val sky = WidgetConfig(palette = WidgetPalette.SKY)

    private fun shootAt(name: String, kind: WidgetKind, size: Pair<Int, Int>, config: WidgetConfig, now: Long) {
        draw(kind, size, config, now).backdrop.captureRoboImage("$SCREENSHOTS/$name.png")
    }

    @Test
    fun samsungWideLight() =
        shootAt("wide_samsung_light", WidgetKind.WIDE, WidgetHarness.SAMSUNG_WIDE, light, ONE_PM)

    @Test
    fun samsungWideSkyMorning() = shootAt(
        "wide_samsung_sky_morning", WidgetKind.WIDE, WidgetHarness.SAMSUNG_WIDE, sky, PayloadFixture.BEFORE_SUNRISE
    )

    @Test
    fun samsungWideSkyMidday() =
        shootAt("wide_samsung_sky_midday", WidgetKind.WIDE, WidgetHarness.SAMSUNG_WIDE, sky, ONE_PM)

    @Test
    fun samsungWideSkySunset() = shootAt(
        "wide_samsung_sky_sunset", WidgetKind.WIDE, WidgetHarness.SAMSUNG_WIDE, sky, PayloadFixture.SUNSET
    )

    @Test
    fun samsungWideSkyNight() = shootAt(
        "wide_samsung_sky_night", WidgetKind.WIDE, WidgetHarness.SAMSUNG_WIDE, sky, PayloadFixture.LATE_NIGHT
    )

    @Test
    fun samsungWideThreeRows() =
        shootAt("wide_samsung_4x3_sky_midday", WidgetKind.WIDE, 374 to 330, sky, ONE_PM)

    @Test
    fun samsungCompactLight() =
        shootAt("compact_samsung_light", WidgetKind.COMPACT, WidgetHarness.SAMSUNG_COMPACT, light, ONE_PM)

    @Test
    fun samsungCompactSkyMidday() =
        shootAt("compact_samsung_sky_midday", WidgetKind.COMPACT, WidgetHarness.SAMSUNG_COMPACT, sky, ONE_PM)

    @Test
    fun samsungCompactSkySunset() = shootAt(
        "compact_samsung_sky_sunset", WidgetKind.COMPACT, WidgetHarness.SAMSUNG_COMPACT, sky, PayloadFixture.SUNSET
    )

    @Test
    fun samsungCompactSkyNight() = shootAt(
        "compact_samsung_sky_night", WidgetKind.COMPACT, WidgetHarness.SAMSUNG_COMPACT, sky, PayloadFixture.LATE_NIGHT
    )

    @Test
    fun samsungCompactTwoRows() =
        shootAt("compact_samsung_4x2_sky_midday", WidgetKind.COMPACT, 374 to 221, sky, ONE_PM)

    @Test
    fun tileAtTwoByTwoWithoutCity() =
        shoot("tile_2x2_no_city", WidgetKind.TILE, 170 to 190, light.copy(showLocation = false))
}
