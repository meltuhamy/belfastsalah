package com.meltuhamy.londonsalah.widget

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
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

    /**
     * The sky at `widthDp` x `heightDp`, drawn at up to `density` pixels a dp.
     * `sunDp` is the sun's diameter: smaller on the narrow widgets.
     */
    fun paint(
        sky: SkyState,
        widthDp: Int,
        heightDp: Int,
        density: Float,
        sunDp: Float
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
        // Maghrib, though the arc keeps it 45 minutes either side.
        sky.sun?.takeIf { light.sunOn > 0 }?.let { sun ->
            val cx = (sun.x * width).toFloat()
            val cy = (sun.y * height).toFloat()
            val radius = sunDp / 2 * scale
            val base = colour(sun.colour)
            val on = light.sunOn.toFloat()

            paint.alpha = 255
            paint.shader = RadialGradient(
                cx, cy, radius * 2.4f,
                intArrayOf(withAlpha(base, 0.5f * on), withAlpha(base, 0.5f * on), withAlpha(base, 0f)),
                floatArrayOf(0f, 1 / 2.4f, 1f),
                Shader.TileMode.CLAMP
            )
            canvas.drawCircle(cx, cy, radius * 2.4f, paint)
            paint.shader = null

            paint.color = withAlpha(base, on)
            canvas.drawCircle(cx, cy, radius, paint)
        }

        return bitmap
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

    private fun withAlpha(colour: Int, alpha: Float): Int =
        (colour and 0x00FFFFFF) or ((alpha * 255).roundToInt() shl 24)
}
