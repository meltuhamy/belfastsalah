package com.meltuhamy.londonsalah.widget

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RadialGradient
import android.graphics.Shader
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Paints a [SkyState] as a picture, for the Sky palette's background.
 *
 * A picture because RemoteViews cannot give a view a gradient at runtime -
 * only a colour or a drawable resource - and the sky's colours, sun and stars,
 * the dawn glow and Fajr's thread are different every time it is drawn. The layouts each have an ImageView,
 * `sky_background`, behind their content for it.
 */
object SkyPainter {

    /**
     * Pixels in the picture at most. A RemoteViews travels between processes
     * in one binder transaction, which fails outright above about 1MB, and a
     * widget's picture is stretched to fit anyway - a gradient loses nothing
     * by being drawn small. About 470KB at four bytes a pixel.
     */
    private const val MAX_PIXELS = 120_000

    /** The stars, as fractions across and down, a radius in dp and a strength. */
    private val STARS = listOf(
        floatArrayOf(0.06f, 0.14f, 1.0f, 0.9f), floatArrayOf(0.14f, 0.38f, 0.75f, 0.6f),
        floatArrayOf(0.22f, 0.09f, 0.75f, 0.7f), floatArrayOf(0.31f, 0.26f, 1.0f, 0.8f),
        floatArrayOf(0.40f, 0.12f, 0.75f, 0.5f), floatArrayOf(0.48f, 0.34f, 0.75f, 0.6f),
        floatArrayOf(0.57f, 0.08f, 1.0f, 0.9f), floatArrayOf(0.64f, 0.22f, 0.75f, 0.6f),
        floatArrayOf(0.72f, 0.40f, 0.75f, 0.5f), floatArrayOf(0.79f, 0.13f, 1.0f, 0.8f),
        floatArrayOf(0.87f, 0.30f, 0.75f, 0.6f), floatArrayOf(0.94f, 0.10f, 0.75f, 0.7f),
        floatArrayOf(0.36f, 0.46f, 0.75f, 0.4f), floatArrayOf(0.84f, 0.52f, 0.75f, 0.4f)
    )

    /** The card's lens flare ghosts (LensFlare.tsx's `GHOSTS`). */
    private data class Ghost(
        val at: Float,
        val size: Float,
        val strength: Double,
        val tint: Triple<Int, Int, Int>,
        val iris: Boolean = false
    )

    private val GHOSTS = listOf(
        Ghost(0.42f, 9f, 0.2, Triple(255, 236, 196)),
        Ghost(0.78f, 18f, 0.09, Triple(196, 255, 222), iris = true),
        Ghost(1.22f, 36f, 0.07, Triple(176, 214, 255)),
        Ghost(1.58f, 15f, 0.13, Triple(255, 208, 168)),
        Ghost(1.96f, 26f, 0.06, Triple(214, 192, 255), iris = true)
    )

    /** The widgets' flare is a touch stronger than the card's, being still. */
    private const val FLARE_BOOST = 1.3

    /**
     * Where the sun sits on a widget, as fractions of its height: [noonY] at
     * the top of `WidgetSky`'s arc and [horizonY] at its ends. The arc itself
     * runs from 0.24 to 0.9; [map] squeezes it into this range.
     */
    data class SunArc(val noonY: Double, val horizonY: Double) {
        fun map(rawY: Double): Double =
            noonY + (rawY - RAW.noonY) * (horizonY - noonY) / (RAW.horizonY - RAW.noonY)

        companion object {
            /** `WidgetSky`'s own arc, drawn as it is. */
            val RAW = SunArc(0.24, 0.9)

            /** Wide widgets: a touch lower at noon, and above the prayer row at sunset. */
            val WIDE = SunArc(0.28, 0.61)
        }
    }

    /**
     * The sky at `widthDp` x `heightDp`, drawn at up to `density` pixels a dp.
     * `sunDp` is the sun's diameter: smaller on the narrow widgets, and
     * `sunArc` where it travels.
     */
    fun paint(
        sky: SkyState,
        widthDp: Int,
        heightDp: Int,
        density: Float,
        sunDp: Float,
        sunArc: SunArc = SunArc.RAW
    ): Bitmap {
        val w = max(widthDp, 1)
        val h = max(heightDp, 1)
        val scale = min(density, sqrt(MAX_PIXELS.toFloat() / (w * h)))
        val width = max((w * scale).roundToInt(), 1)
        val height = max((h * scale).roundToInt(), 1)

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        // The same stops as the app's countdown card.
        paint.shader = LinearGradient(
            0f, 0f, 0f, height.toFloat(),
            intArrayOf(colour(sky.top), colour(sky.mid), colour(sky.horizon)),
            floatArrayOf(0f, 0.6f, 1f),
            Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        paint.shader = null

        if (sky.night > 0) {
            for ((x, y, r, strength) in STARS) {
                paint.color = Color.WHITE
                paint.alpha = (255 * strength * sky.night).roundToInt().coerceIn(0, 255)
                canvas.drawCircle(x * width, y * height, max(r * scale, 0.75f), paint)
            }
        }

        val light = sky.light

        // Before sunrise, a warm glow on the horizon at the left, where the
        // sun will come up - as the app's card draws it (PrayerDayCard.css).
        if (light.dawn > 0) {
            ellipse(
                canvas, paint,
                cx = 0f, cy = 0.6f * height, rx = 0.65f * width, ry = 0.35f * height,
                colours = intArrayOf(
                    argb(0.9 * light.dawn, 255, 196, 120),
                    argb(0.6 * light.dawn, 255, 160, 90),
                    argb(0.22 * light.dawn, 255, 130, 90),
                    argb(0.0, 255, 120, 90)
                ),
                stops = floatArrayOf(0f, 0.3f, 0.65f, 1f)
            )
        }

        // Fajr's white thread in a haze. The sizes are the card's, which is
        // 252dp tall; a shorter widget gets a shallower haze, never less
        // than about half. Still, where the card's line breathes: a widget
        // is redrawn every quarter hour, so nothing on it can move.
        val thread = light.thread
        if (thread.haze > 0 || thread.line > 0) {
            val (r, g, b) = thread.rgb.split(", ").map { it.trim().toInt() }
            val cx = (thread.x * width).toFloat()
            val cy = 0.5f * height
            val depth = (h / 252.0).coerceIn(0.55, 1.0)
            if (thread.haze > 0) {
                ellipse(
                    canvas, paint,
                    cx = cx, cy = cy,
                    rx = (thread.hazeWidth * width / 2).toFloat(),
                    ry = (thread.hazeHeight * depth * scale / 2).toFloat(),
                    colours = intArrayOf(
                        argb(thread.haze, r, g, b),
                        argb(thread.haze * 0.62, r, g, b),
                        argb(thread.haze * 0.25, r, g, b),
                        argb(0.0, r, g, b)
                    ),
                    stops = floatArrayOf(0f, 0.35f, 0.65f, 1f)
                )
            }
            if (thread.line > 0) {
                ellipse(
                    canvas, paint,
                    cx = cx, cy = cy,
                    rx = (thread.lineWidth * width / 2).toFloat(),
                    ry = 2f * scale,
                    colours = intArrayOf(
                        argb(thread.line, r, g, b),
                        argb(thread.line * 0.5, r, g, b),
                        argb(0.0, r, g, b)
                    ),
                    stops = floatArrayOf(0f, 0.45f, 1f)
                )
            }
        }

        // The sun, at the card's strength: none before Shuruq, fading after
        // Maghrib, though the arc keeps it 45 minutes either side. A bloom,
        // as the card draws it (PrayerDayCard.css): a wide, faint wash and a
        // white-hot core fading through the sun's colour, both sized for the
        // card's 40dp sun and scaled to this one's. Screen-blended, so it
        // only brightens the sky. Then the card's lens flare, held still.
        sky.sun?.takeIf { light.sunOn > 0 }?.let { sun ->
            val cx = (sun.x * width).toFloat()
            val cy = (sunArc.map(sun.y) * height).toFloat()
            val k = sunDp / 40f * scale
            val on = light.sunOn
            val base = colour(sun.colour)
            val r = Color.red(base)
            val g = Color.green(base)
            val b = Color.blue(base)

            paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SCREEN)
            radial(
                canvas, paint, cx, cy, 130f * k,
                intArrayOf(argb(0.22 * on, 255, 252, 240), argb(0.0, 255, 252, 240)),
                floatArrayOf(0f, 1f)
            )
            radial(
                canvas, paint, cx, cy, 75f * k,
                intArrayOf(
                    argb(on, 255, 255, 255),
                    argb(0.96 * on, 255, 255, 255),
                    argb(0.92 * on, r, g, b),
                    argb(0.5 * on, r, g, b),
                    argb(0.22 * on, r, g, b),
                    argb(0.08 * on, r, g, b),
                    argb(0.0, r, g, b)
                ),
                floatArrayOf(0f, 0.07f, 0.13f, 0.22f, 0.36f, 0.58f, 1f)
            )
            val flareScale = (min(w, h) / 200f).coerceIn(0.35f, 1f) * scale
            flare(canvas, paint, cx, cy, width / 2f, height / 2f, flareScale, on, scale)
            paint.xfermode = null
        }

        return bitmap
    }

    /**
     * The card's lens flare (LensFlare.tsx), held still since a widget cannot
     * move: a faint veil about the sun, and its five ghosts on the line from
     * the sun through the widget's middle - a touch stronger than the card's,
     * with no movement to catch the eye. `k` is pixels per card px.
     */
    private fun flare(
        canvas: Canvas,
        paint: Paint,
        sx: Float,
        sy: Float,
        cx: Float,
        cy: Float,
        k: Float,
        on: Double,
        pxPerDp: Float
    ) {
        radial(
            canvas, paint, sx, sy, 110f * k,
            intArrayOf(argb(0.12 * on, 255, 248, 228), argb(0.0, 255, 248, 228)),
            floatArrayOf(0f, 1f)
        )
        for (ghost in GHOSTS) {
            val x = sx + (cx - sx) * ghost.at
            val y = sy + (cy - sy) * ghost.at
            val radius = max(ghost.size * k, 5f * pxPerDp) / 2
            val s = ghost.strength * FLARE_BOOST * on
            val (r, g, b) = ghost.tint
            val colours = intArrayOf(
                argb(s * 0.55, r, g, b),
                argb(s * 0.7, r, g, b),
                argb(s, r, g, b),
                argb(0.0, r, g, b)
            )
            val stops = floatArrayOf(0f, 0.62f, 0.82f, 1f)
            if (ghost.iris) {
                // The camera's iris: a hexagon, as the card clips it.
                canvas.save()
                canvas.clipPath(hexagon(x, y, radius))
                radial(canvas, paint, x, y, radius * sqrt(2f), colours, stops, square = true)
                canvas.restore()
            } else {
                radial(canvas, paint, x, y, radius, colours, stops)
            }
        }
    }

    /**
     * The card's `polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)`
     * on a box `radius` either side of (cx, cy).
     */
    private fun hexagon(cx: Float, cy: Float, radius: Float): Path {
        val d = radius * 2
        val left = cx - radius
        val top = cy - radius
        return Path().apply {
            moveTo(left + 0.25f * d, top + 0.03f * d)
            lineTo(left + 0.75f * d, top + 0.03f * d)
            lineTo(left + d, top + 0.5f * d)
            lineTo(left + 0.75f * d, top + 0.97f * d)
            lineTo(left + 0.25f * d, top + 0.97f * d)
            lineTo(left, top + 0.5f * d)
            close()
        }
    }

    /**
     * A radial gradient about (cx, cy), as CSS's `circle closest-side`. With
     * `square`, `radius` is the corner's distance and the stops are laid
     * out on the box's half side, as CSS does for a square element whose
     * clip-path cuts it - the iris ghosts.
     */
    private fun radial(
        canvas: Canvas,
        paint: Paint,
        cx: Float,
        cy: Float,
        radius: Float,
        colours: IntArray,
        stops: FloatArray,
        square: Boolean = false
    ) {
        if (radius <= 0f) return
        val gradientRadius = if (square) radius / sqrt(2f) else radius
        paint.alpha = 255
        paint.shader = RadialGradient(cx, cy, gradientRadius, colours, stops, Shader.TileMode.CLAMP)
        canvas.drawCircle(cx, cy, radius, paint)
        paint.shader = null
    }

    private fun colour(hex: String): Int = Color.parseColor(hex)

    private fun argb(alpha: Double, r: Int, g: Int, b: Int): Int =
        Color.argb((alpha.coerceIn(0.0, 1.0) * 255).roundToInt(), r, g, b)

    /** A radial gradient stretched into an ellipse about (cx, cy). */
    private fun ellipse(
        canvas: Canvas,
        paint: Paint,
        cx: Float,
        cy: Float,
        rx: Float,
        ry: Float,
        colours: IntArray,
        stops: FloatArray
    ) {
        if (rx <= 0f || ry <= 0f) return
        canvas.save()
        canvas.translate(cx, cy)
        canvas.scale(rx / ry, 1f)
        paint.alpha = 255
        paint.shader = RadialGradient(0f, 0f, ry, colours, stops, Shader.TileMode.CLAMP)
        canvas.drawCircle(0f, 0f, ry, paint)
        paint.shader = null
        canvas.restore()
    }

}
