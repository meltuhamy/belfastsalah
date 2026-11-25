package com.meltuhamy.londonsalah.widget

import java.io.File
import kotlin.math.abs
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Sky palette's colours, held to TypeScript's.
 *
 * WidgetSky repeats skyAtDays from src/lib/sky.ts. Both read
 * fixtures/widget-payload/london-2026-01-15.json; the samples beside it are
 * what TypeScript worked out from it, every ten minutes for two days and every
 * minute through dawn and into sunset. If the two blends drift apart - a
 * change to sky.ts not made here, or the other way round - this fails.
 */
class WidgetSkyTest {

    /** The repository's fixtures, found from wherever Gradle runs the tests. */
    private val fixtures: File = generateSequence(File("").absoluteFile) { it.parentFile }
        .map { File(it, "fixtures/widget-payload") }
        .first { it.isDirectory }

    private val payload =
        WidgetPayload.parse(File(fixtures, "london-2026-01-15.json").readText())!!

    private fun channels(hex: String) =
        listOf(1, 3, 5).map { hex.substring(it, it + 2).toInt(16) }

    /**
     * How far apart two colours are, in the largest single channel. Kotlin's
     * and JavaScript's maths libraries can round the last bit of a power or
     * cube root differently, which can tip a channel by one.
     */
    private fun distance(a: String, b: String) =
        channels(a).zip(channels(b)).maxOf { (x, y) -> abs(x - y) }

    @Test
    fun `draws the same sky as the app at every sample`() {
        val samples = JSONObject(File(fixtures, "sky-london-2026-01-15.json").readText())
            .getJSONArray("samples")
        assertTrue(samples.length() > 400)

        for (i in 0 until samples.length()) {
            val expected = samples.getJSONObject(i)
            val at = expected.getLong("at")
            val sky = payload.skyAt(at)!!
            val label = "sample at $at"

            for ((field, actual) in listOf("top" to sky.top, "mid" to sky.mid, "horizon" to sky.horizon)) {
                val wanted = expected.getString(field)
                assertTrue("$label $field: $actual, not $wanted", distance(actual, wanted) <= 1)
            }
            assertEquals("$label text", expected.getString("text") == "light", sky.lightText)
            assertEquals(label + " night", expected.getDouble("night"), sky.night, 1e-9)

            if (expected.isNull("sun")) {
                assertNull("$label sun", sky.sun)
            } else {
                val sun = expected.getJSONObject("sun")
                assertEquals("$label sun x", sun.getDouble("x"), sky.sun!!.x, 1e-9)
                assertEquals("$label sun y", sun.getDouble("y"), sky.sun!!.y, 1e-9)
                assertTrue(distance(sky.sun!!.colour, sun.getString("colour")) <= 1)
            }

            // The sun's strength, the dawn glow and Fajr's thread.
            val light = expected.getJSONObject("light")
            assertEquals("$label sunOn", light.getDouble("sunOn"), sky.light.sunOn, 1e-9)
            assertEquals("$label dawn", light.getDouble("dawn"), sky.light.dawn, 1e-9)
            val thread = light.getJSONObject("thread")
            val actual = sky.light.thread
            for ((field, value) in listOf(
                "x" to actual.x,
                "hazeWidth" to actual.hazeWidth,
                "hazeHeight" to actual.hazeHeight,
                "haze" to actual.haze,
                "lineWidth" to actual.lineWidth,
                "line" to actual.line
            )) {
                assertEquals("$label thread $field", thread.getDouble(field), value, 1e-9)
            }
            assertEquals("$label thread rgb", thread.getString("rgb"), actual.rgb)
        }
    }

    @Test
    fun `has no sun before Shuruq, and a dawn glow and Fajr's thread instead`() {
        // 15 January 2026, London: Fajr 06:20, Shuruq 07:57.
        val before = payload.skyAt(java.time.Instant.parse("2026-01-15T07:30:00Z").toEpochMilli())!!
        assertTrue("the arc has a sun", before.sun != null)
        assertEquals(0.0, before.light.sunOn, 0.0)
        assertTrue(before.light.dawn > 0.2)
        assertTrue(before.light.thread.haze > 0)

        val atFajr = payload.skyAt(java.time.Instant.parse("2026-01-15T06:20:00Z").toEpochMilli())!!
        assertEquals(0.95, atFajr.light.thread.line, 1e-9)

        val noon = payload.skyAt(java.time.Instant.parse("2026-01-15T12:00:00Z").toEpochMilli())!!
        assertEquals(1.0, noon.light.sunOn, 0.0)
        assertEquals(0.0, noon.light.dawn, 0.0)
        assertEquals(0.0, noon.light.thread.haze, 0.0)
    }

    @Test
    fun `is night before the first day begins and after the last ends`() {
        val first = payload.days.first().sky.first()
        val last = payload.days.last().sky.last()
        for (at in listOf(first - 1, last + 1)) {
            val sky = payload.skyAt(at)!!
            assertEquals(payload.skyColours[0].top, sky.top)
            assertTrue(sky.lightText)
            assertNull(sky.sun)
        }
    }
}
