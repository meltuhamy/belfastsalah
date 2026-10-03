package com.meltuhamy.londonsalah.widget

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import com.meltuhamy.londonsalah.R

/**
 * How one placed widget should look. Stored per appWidgetId, because two
 * copies of the same widget on the same home screen are allowed to differ.
 *
 * Choices are stored, not resolved colours. "System" has to mean whatever the
 * device is set to *now*, which is only known at draw time, and keeping the
 * stored form small means the palettes can be adjusted later without
 * migrating anyone's settings.
 */
enum class WidgetPalette { SYSTEM, LIGHT, DARK }

enum class WidgetTextTone { AUTO, LIGHT, DARK }

enum class CountdownMode {
    /** A live Chronometer. The launcher ticks it, so it costs nothing. */
    SECONDS,

    /**
     * The prayer's clock time instead. Chronometer cannot omit seconds, and a
     * minute-granularity countdown would have to be redrawn by us every
     * minute - which widgets cannot do cheaply.
     */
    TIME,

    /** No countdown at all. */
    NONE
}

data class WidgetConfig(
    val palette: WidgetPalette = WidgetPalette.SYSTEM,
    /** 0 is fully transparent, 100 fully opaque. */
    val opacity: Int = 100,
    val textTone: WidgetTextTone = WidgetTextTone.AUTO,
    /** Index into ACCENTS, or NO_ACCENT. */
    val accent: Int = 0,
    val countdown: CountdownMode = CountdownMode.SECONDS,
    /**
     * Whether to name the city and date the times belong to. Both are worth
     * having by default and both are the first thing to go on a home screen
     * that already answers them - the widget is a glance at the times, not a
     * statement of where you are.
     */
    val showLocation: Boolean = true,
    val showDate: Boolean = true
) {

    private fun dark(context: Context): Boolean = when (palette) {
        WidgetPalette.LIGHT -> false
        WidgetPalette.DARK -> true
        WidgetPalette.SYSTEM ->
            (context.resources.configuration.uiMode and
                Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    }

    fun backgroundColor(context: Context): Int {
        val base = if (dark(context)) DARK_BACKGROUND else LIGHT_BACKGROUND
        val alpha = (opacity.coerceIn(0, 100) * 255 / 100) shl 24
        return (base and 0x00FFFFFF) or alpha
    }

    /**
     * Text is read against whatever is behind the widget once the background
     * goes translucent, so a transparent widget defaults to light text - the
     * wallpaper below is more often dark than not, and either way the user can
     * override it.
     */
    private fun lightText(context: Context): Boolean = when (textTone) {
        WidgetTextTone.LIGHT -> true
        WidgetTextTone.DARK -> false
        WidgetTextTone.AUTO -> dark(context) || opacity < 50
    }

    fun primaryTextColor(context: Context): Int =
        if (lightText(context)) LIGHT_TEXT else DARK_TEXT

    fun secondaryTextColor(context: Context): Int =
        if (lightText(context)) LIGHT_TEXT_MUTED else DARK_TEXT_MUTED

    /** The rounded pill behind the next prayer, or 0 for no highlight. */
    fun accentDrawable(): Int =
        if (accent < 0 || accent >= ACCENTS.size) 0 else ACCENTS[accent].drawable

    fun accentTextColor(context: Context): Int =
        if (accent < 0 || accent >= ACCENTS.size) primaryTextColor(context)
        else ACCENTS[accent].onAccent

    data class Accent(val drawable: Int, val onAccent: Int, val label: Int)

    companion object {
        const val NO_ACCENT = -1

        private const val LIGHT_BACKGROUND = 0xFFFFFFFF.toInt()
        private const val DARK_BACKGROUND = 0xFF1E1E1E.toInt()
        private const val LIGHT_TEXT = 0xFFFFFFFF.toInt()
        private const val LIGHT_TEXT_MUTED = 0xFFB3B3B3.toInt()
        private const val DARK_TEXT = 0xFF1B1B1B.toInt()
        private const val DARK_TEXT_MUTED = 0xFF5F6368.toInt()

        /**
         * Highlights are drawables rather than plain colours so the pill keeps
         * its rounded corners: RemoteViews cannot tint a background before
         * API 31, and this app supports 24.
         */
        val ACCENTS = listOf(
            Accent(R.drawable.widget_accent_blue, Color.WHITE, R.string.widget_accent_blue),
            Accent(R.drawable.widget_accent_green, Color.BLACK, R.string.widget_accent_green),
            Accent(R.drawable.widget_accent_amber, Color.BLACK, R.string.widget_accent_amber),
            Accent(R.drawable.widget_accent_violet, Color.WHITE, R.string.widget_accent_violet)
        )

        private const val FILE = "prayer_widget_config"

        fun load(context: Context, appWidgetId: Int): WidgetConfig {
            val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            val default = WidgetConfig()
            return WidgetConfig(
                palette = runCatching {
                    WidgetPalette.valueOf(
                        prefs.getString(key(appWidgetId, "palette"), default.palette.name)!!
                    )
                }.getOrDefault(default.palette),
                opacity = prefs.getInt(key(appWidgetId, "opacity"), default.opacity),
                textTone = runCatching {
                    WidgetTextTone.valueOf(
                        prefs.getString(key(appWidgetId, "text"), default.textTone.name)!!
                    )
                }.getOrDefault(default.textTone),
                accent = prefs.getInt(key(appWidgetId, "accent"), default.accent),
                countdown = runCatching {
                    CountdownMode.valueOf(
                        prefs.getString(key(appWidgetId, "countdown"), default.countdown.name)!!
                    )
                }.getOrDefault(default.countdown),
                showLocation = prefs.getBoolean(
                    key(appWidgetId, "location"), default.showLocation
                ),
                showDate = prefs.getBoolean(key(appWidgetId, "date"), default.showDate)
            )
        }

        fun save(context: Context, appWidgetId: Int, config: WidgetConfig) {
            context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
                .putString(key(appWidgetId, "palette"), config.palette.name)
                .putInt(key(appWidgetId, "opacity"), config.opacity)
                .putString(key(appWidgetId, "text"), config.textTone.name)
                .putInt(key(appWidgetId, "accent"), config.accent)
                .putString(key(appWidgetId, "countdown"), config.countdown.name)
                .putBoolean(key(appWidgetId, "location"), config.showLocation)
                .putBoolean(key(appWidgetId, "date"), config.showDate)
                .apply()
        }

        /** Called when a widget is removed, so settings do not accumulate. */
        fun delete(context: Context, appWidgetIds: IntArray) {
            val editor = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
            for (id in appWidgetIds) {
                for (field in FIELDS) {
                    editor.remove(key(id, field))
                }
            }
            editor.apply()
        }

        private val FIELDS =
            listOf("palette", "opacity", "text", "accent", "countdown", "location", "date")

        private fun key(appWidgetId: Int, field: String) = "w${appWidgetId}_$field"
    }
}
