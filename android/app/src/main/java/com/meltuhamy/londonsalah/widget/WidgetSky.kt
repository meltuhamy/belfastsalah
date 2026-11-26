package com.meltuhamy.londonsalah.widget

import kotlin.math.PI
import kotlin.math.cbrt
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToLong
import kotlin.math.sin
import kotlin.math.sqrt

/** One sky point's colours, top of the sky to the horizon, as "#rrggbb". */
data class SkyColours(val top: String, val mid: String, val horizon: String)

/** Where the sun is, as fractions of the widget: x from the left, y from the top. */
data class SkySun(val x: Double, val y: Double, val colour: String)

/** The sky at one instant: what a Sky widget draws. */
data class SkyState(
    val top: String,
    val mid: String,
    val horizon: String,
    /** White text rather than black. */
    val lightText: Boolean,
    /** Null while the sun is well below the horizon. */
    val sun: SkySun?,
    /** 0 by day, 1 once the stars are fully out. */
    val night: Double,
    /** The sun's strength, the dawn glow and Fajr's thread. */
    val light: SkyLight
)

/**
 * Fajr's white thread in a haze, as fajrThread in src/lib/sky.ts gives it:
 * sizes for a card 380 wide (widths as fractions of the width, the haze's
 * height in px of that card), strengths 0 to 1, the colour as "r, g, b".
 */
data class FajrThread(
    val x: Double,
    val hazeWidth: Double,
    val hazeHeight: Double,
    val haze: Double,
    val lineWidth: Double,
    val line: Double,
    val rgb: String
)

/** skyLightAtTimes in src/lib/sky.ts: the light on the sky that is not its colour. */
data class SkyLight(
    /** How much of the sun to draw: none before Shuruq, fading after Maghrib. */
    val sunOn: Double,
    /** The glow on the horizon before sunrise, 0 to 1. */
    val dawn: Double,
    val thread: FajrThread
)

/**
 * The sky for an instant, worked out exactly as skyAtDays in src/lib/sky.ts
 * does - a line-by-line port, from the same points and colours the app sends
 * in the payload.
 *
 * It is the one piece of calculation the widgets do themselves, because the
 * sky changes all day and the payload is written only when the app runs.
 * WidgetSkyTest holds it to fixtures/widget-payload/sky-london-2026-01-15.json,
 * which TypeScript writes from its own answer: a change on one side and not
 * the other fails there.
 */
object WidgetSky {

    private const val MINUTE = 60_000.0

    /**
     * `days` are each day's ten point times in the order the payload writes
     * them; `colours` the ten points' colours. Uses the last day that has
     * begun: between one day's last point and the next day's first, both are
     * the same night.
     */
    fun at(t: Long, days: List<LongArray>, colours: List<SkyColours>): SkyState {
        var chosen = days[0]
        for (times in days) {
            if (times[0] <= t) chosen = times
        }
        return atTimes(t, chosen, colours)
    }

    fun atTimes(t: Long, times: LongArray, colours: List<SkyColours>): SkyState {
        // Night: the first point's colours, which the last point's repeat.
        var sky = colours[0]
        for (i in 0 until times.size - 1) {
            if (t >= times[i] && t < times[i + 1]) {
                sky = blend(
                    colours[i],
                    colours[i + 1],
                    (t - times[i]).toDouble() / (times[i + 1] - times[i]).toDouble()
                )
                break
            }
        }

        val fajr = times[1].toDouble()
        val shuruq = times[2].toDouble()
        val maghrib = times[7].toDouble()
        val isha = times[8].toDouble()
        val now = t.toDouble()

        val progress = (now - shuruq) / (maghrib - shuruq)
        val elevation = sin(PI * progress)
        val sunUp = now >= shuruq - 45 * MINUTE && now <= maghrib + 45 * MINUTE

        var night = 0.0
        if (now >= isha) night = min(1.0, (now - isha) / (60 * MINUTE))
        else if (now < fajr) night = min(1.0, (fajr - now) / (40 * MINUTE))

        return SkyState(
            top = sky.top,
            mid = sky.mid,
            horizon = sky.horizon,
            lightText = lightTextFor(sky.top, sky.mid),
            sun = if (sunUp) SkySun(
                x = 0.08 + clamp(progress, -0.1, 1.1) * 0.84,
                y = 0.9 - elevation * 0.66,
                colour = mixOklab("#ff9e4a", "#fff7dc", clamp(elevation * 1.6, 0.0, 1.0))
            ) else null,
            night = night,
            light = lightAtTimes(t, times)
        )
    }

    // --- The light, as skyLightAtTimes in sky.ts ------------------------------

    private const val SUNRISE_FADE = 3 * MINUTE
    private const val SUNSET_FADE = 10 * MINUTE
    private const val DAWN_BEFORE = 45 * MINUTE
    private const val DAWN_AFTER = 20 * MINUTE
    private const val THREAD_BEFORE = 60 * MINUTE
    private const val THREAD_FADE_IN = 10 * MINUTE
    private const val THREAD_LINE = 25 * MINUTE
    private const val CARD = 380.0

    /** From Fajr to Shuruq, as THREAD_AFTER in sky.ts. */
    private val THREAD_AFTER: List<Pair<Double, DoubleArray>> = listOf(
        0.0 to doubleArrayOf(50.0, 480.0, 60.0, 228.0, 220.0, 255.0, 0.32, 0.95),
        0.05 to doubleArrayOf(50.0, 480.0, 60.0, 228.0, 220.0, 255.0, 0.3, 0.7),
        0.22 to doubleArrayOf(44.0, 440.0, 58.0, 238.0, 218.0, 240.0, 0.26, 0.35),
        0.56 to doubleArrayOf(32.0, 380.0, 56.0, 255.0, 212.0, 200.0, 0.22, 0.12),
        0.83 to doubleArrayOf(18.0, 300.0, 54.0, 255.0, 200.0, 170.0, 0.14, 0.0),
        1.0 to doubleArrayOf(10.0, 260.0, 52.0, 255.0, 196.0, 160.0, 0.0, 0.0)
    )

    private val NO_THREAD = FajrThread(0.5, 0.0, 0.0, 0.0, 0.0, 0.0, "228, 220, 255")

    fun lightAtTimes(t: Long, times: LongArray): SkyLight {
        val now = t.toDouble()
        val fajr = times[1].toDouble()
        val shuruq = times[2].toDouble()
        val maghrib = times[7].toDouble()
        return SkyLight(
            sunOn = sunShowing(now, shuruq, maghrib),
            dawn = dawnGlow(now, shuruq),
            thread = fajrThread(now, fajr, shuruq)
        )
    }

    private fun sunShowing(t: Double, shuruq: Double, maghrib: Double): Double = when {
        t < shuruq -> 0.0
        t <= maghrib -> clamp((t - shuruq) / SUNRISE_FADE, 0.0, 1.0)
        else -> clamp(1 - (t - maghrib) / SUNSET_FADE, 0.0, 1.0)
    }

    private fun dawnGlow(t: Double, shuruq: Double): Double =
        if (t < shuruq) clamp(1 - (shuruq - t) / DAWN_BEFORE, 0.0, 1.0).pow(0.6)
        else clamp(1 - (t - shuruq) / DAWN_AFTER, 0.0, 1.0)

    private fun fajrThread(t: Double, fajr: Double, shuruq: Double): FajrThread {
        val v: DoubleArray
        if (t < fajr) {
            val before = fajr - t
            if (before > THREAD_BEFORE) return NO_THREAD
            val k = 1 - before / THREAD_BEFORE
            val a = (0.1 + 0.22 * k) * clamp((THREAD_BEFORE - before) / THREAD_FADE_IN, 0.0, 1.0)
            val line = 0.6 * clamp(1 - before / THREAD_LINE, 0.0, 1.0)
            v = doubleArrayOf(50.0, 260 + 220 * k, 34 + 26 * k, 228.0, 220.0, 255.0, a, line)
        } else {
            if (t >= shuruq) return NO_THREAD
            val f = (t - fajr) / (shuruq - fajr)
            val i = THREAD_AFTER.indices.first { n ->
                f >= THREAD_AFTER[n].first &&
                    f < (THREAD_AFTER.getOrNull(n + 1)?.first ?: Double.POSITIVE_INFINITY)
            }
            val (from, fromValues) = THREAD_AFTER[i]
            val (to, toValues) = THREAD_AFTER[min(i + 1, THREAD_AFTER.size - 1)]
            val s = if (to == from) 0.0 else (f - from) / (to - from)
            v = DoubleArray(8) { fromValues[it] + (toValues[it] - fromValues[it]) * s }
        }
        return FajrThread(
            x = v[0] / 100,
            hazeWidth = (v[1] * 1.1) / CARD,
            hazeHeight = v[2] * 1.7,
            haze = v[6] * 1.15,
            lineWidth = (v[1] * 0.65) / CARD,
            line = v[7],
            rgb = "${jsRound(v[3])}, ${jsRound(v[4])}, ${jsRound(v[5])}"
        )
    }

    /** JavaScript's Math.round, for the colour's channels. */
    private fun jsRound(x: Double): Long = kotlin.math.floor(x + 0.5).toLong()

    // --- The blend, as in sky.ts ---------------------------------------------

    private val EVEN_LUMINANCE = sqrt(1.05 * 0.05) - 0.05

    private val crossings = HashMap<String, Double?>()

    private fun crossing(a: String, b: String): Double? {
        val key = a + b
        if (crossings.containsKey(key)) return crossings[key]
        fun side(f: Double) = luminance(mixOklab(a, b, f)) > EVEN_LUMINANCE
        var result: Double? = null
        if (side(0.0) != side(1.0)) {
            var lo = 0.0
            var hi = 1.0
            repeat(30) {
                val midpoint = (lo + hi) / 2
                if (side(midpoint) == side(0.0)) lo = midpoint else hi = midpoint
            }
            result = (lo + hi) / 2
        }
        crossings[key] = result
        return result
    }

    private fun bend(f: Double, from: Double, to: Double): Double =
        if (f <= from) (f * to) / from else to + ((f - from) * (1 - to)) / (1 - from)

    private fun blend(a: SkyColours, b: SkyColours, f: Double): SkyColours {
        val top = crossing(a.top, b.top)
        val mid = crossing(a.mid, b.mid)
        val horizon = crossing(a.horizon, b.horizon)

        val midF = if (top != null && mid != null) bend(f, top, mid) else f
        val midAt = if (top != null && mid != null) top else mid
        val horizonF = if (midAt != null && horizon != null) bend(f, midAt, horizon) else f

        return SkyColours(
            top = mixOklab(a.top, b.top, f),
            mid = mixOklab(a.mid, b.mid, midF),
            horizon = mixOklab(a.horizon, b.horizon, horizonF)
        )
    }

    private fun lightTextFor(a: String, b: String): Boolean {
        fun worst(text: String) = min(contrastRatio(text, a), contrastRatio(text, b))
        return worst("#ffffff") >= worst("#000000")
    }

    // --- Colour arithmetic, as in sky.ts --------------------------------------

    private fun clamp(x: Double, lo: Double, hi: Double) = max(lo, min(hi, x))

    private fun parseHex(hex: String): IntArray {
        val n = hex.substring(1).toInt(16)
        return intArrayOf((n shr 16) and 255, (n shr 8) and 255, n and 255)
    }

    private fun toHex(rgb: DoubleArray): String =
        "#" + rgb.joinToString("") {
            // JavaScript's Math.round: halves go up. roundToLong rounds them
            // away from zero, which is the same for these, all positive.
            clamp(it, 0.0, 255.0).roundToLong().toString(16).padStart(2, '0')
        }

    private fun toLinear(c: Int): Double {
        val v = c / 255.0
        return if (v <= 0.04045) v / 12.92 else ((v + 0.055) / 1.055).pow(2.4)
    }

    private fun fromLinear(v: Double): Double =
        255 * (if (v <= 0.0031308) 12.92 * v else 1.055 * v.pow(1 / 2.4) - 0.055)

    private fun toOklab(hex: String): DoubleArray {
        val (r, g, b) = parseHex(hex).map { toLinear(it) }
        val l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
        val m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
        val s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
        return doubleArrayOf(
            0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
        )
    }

    private fun fromOklab(lab: DoubleArray): String {
        val (L, a, b) = lab.toList()
        val l = (L + 0.3963377774 * a + 0.2158037573 * b).pow(3)
        val m = (L - 0.1055613458 * a - 0.0638541728 * b).pow(3)
        val s = (L - 0.0894841775 * a - 1.291485548 * b).pow(3)
        return toHex(
            doubleArrayOf(
                4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
            ).map { fromLinear(clamp(it, 0.0, 1.0)) }.toDoubleArray()
        )
    }

    fun mixOklab(a: String, b: String, f: Double): String {
        val x = toOklab(a)
        val y = toOklab(b)
        return fromOklab(DoubleArray(3) { x[it] + (y[it] - x[it]) * f })
    }

    private fun luminance(hex: String): Double {
        val (r, g, b) = parseHex(hex).map { toLinear(it) }
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    private fun contrastRatio(a: String, b: String): Double {
        val x = luminance(a)
        val y = luminance(b)
        return (max(x, y) + 0.05) / (min(x, y) + 0.05)
    }
}
