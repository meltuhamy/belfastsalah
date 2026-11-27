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
enum class WidgetPalette {
    SYSTEM, LIGHT, DARK,

    /**
     * The sky for the moment, as the app's Sky theme draws it: a gradient
     * with the sun and stars, worked out by WidgetSky from the payload. Its
     * colours change all day, so they are passed in at draw time as a
     * [SkyState] rather than decided here.
     */
    SKY
}

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
        // Only reached without a sky to draw - no payload yet - when the
        // widget is asking to be opened. The night is the sky's resting state.
        WidgetPalette.SKY -> true
    }

    /**
     * Opacity as an alpha, 0-255. The Sky palette applies it to the sky's
     * picture rather than to a colour.
     */
    fun alpha(): Int = opacity.coerceIn(0, 100) * 255 / 100

    /** `sky` is the moment's sky for the Sky palette, and null otherwise. */
    fun backgroundColor(context: Context, sky: SkyState? = null): Int {
        // The sky is a picture behind the content (WidgetRenderer), so the
        // content itself is see-through.
        if (sky != null) return 0
        val base = if (dark(context)) DARK_BACKGROUND else LIGHT_BACKGROUND
        return (base and 0x00FFFFFF) or (alpha() shl 24)
    }

    /**
     * Text is read against whatever is behind the widget once the background
     * goes translucent, so a transparent widget defaults to light text - the
     * wallpaper below is more often dark than not, and either way the user can
     * override it. That holds for the sky too: sky.ts's choice of black or
     * white is for the sky itself, so it decides only while the sky is mostly
     * there. A faded midday sky over a dark wallpaper took black text.
     */
    private fun lightText(context: Context, sky: SkyState?): Boolean = when (textTone) {
        WidgetTextTone.LIGHT -> true
        WidgetTextTone.DARK -> false
        WidgetTextTone.AUTO ->
            if (sky != null && opacity >= 50) sky.lightText else dark(context) || opacity < 50
    }

    /**
     * On the sky, black or white at full strength, as sky.ts chose it: the
     * contrast it guarantees is for those two exactly.
     */
    fun primaryTextColor(context: Context, sky: SkyState? = null): Int =
        if (lightText(context, sky)) LIGHT_TEXT else if (sky != null) SKY_DARK_TEXT else DARK_TEXT

    fun secondaryTextColor(context: Context, sky: SkyState? = null): Int =
        if (sky != null && textTone == WidgetTextTone.AUTO) primaryTextColor(context, sky)
        else if (lightText(context, sky)) LIGHT_TEXT_MUTED
        else DARK_TEXT_MUTED

    private fun hasAccent() = accent >= 0 && accent < ACCENTS.size

    /**
     * The rounded block behind the next prayer, or 0 for no highlight. On the
     * sky a coloured block fights the gradient, so it is the sky itself made
     * darker, with white text - a solid block that is found at a glance
     * (MEL-370; it was a faint frosted pane). A night sky is too dark for a
     * darker block to show, so there it is lighter instead.
     */
    fun accentDrawable(context: Context? = null, sky: SkyState? = null): Int = when {
        !hasAccent() -> 0
        sky != null && opacity >= 50 && skyIsDarkBehindTimes(sky) ->
            R.drawable.widget_accent_sky_light
        sky != null -> R.drawable.widget_accent_sky_dark
        else -> ACCENTS[accent].drawable
    }

    /**
     * The text on the highlight. On the sky that is white whatever the rest
     * of the widget uses: both of the sky's blocks are made for white.
     */
    fun accentTextColor(context: Context, sky: SkyState? = null): Int = when {
        !hasAccent() -> primaryTextColor(context, sky)
        sky != null -> LIGHT_TEXT
        else -> ACCENTS[accent].onAccent
    }

    data class Accent(val drawable: Int, val onAccent: Int, val label: Int)

    /**
     * Whether the sky where the times sit - between its middle and its
     * horizon - is too dark for a darker block to stand out from it. Below
     * this luminance, 50% black takes the sky to less than 1.5:1 against
     * itself.
     */
    internal fun skyIsDarkBehindTimes(sky: SkyState): Boolean {
        val mid = Color.parseColor(sky.mid)
        val horizon = Color.parseColor(sky.horizon)
        fun halfway(shift: Int) = (((mid shr shift) and 0xFF) + ((horizon shr shift) and 0xFF)) / 2
        val behind = Color.rgb(halfway(16), halfway(8), halfway(0))
        return Color.luminance(behind) < DARK_SKY_LUMINANCE
    }

    companion object {
        const val NO_ACCENT = -1

        private const val LIGHT_BACKGROUND = 0xFFFFFFFF.toInt()
        private const val DARK_BACKGROUND = 0xFF1E1E1E.toInt()
        private const val LIGHT_TEXT = 0xFFFFFFFF.toInt()
        private const val LIGHT_TEXT_MUTED = 0xFFB3B3B3.toInt()
        private const val DARK_TEXT = 0xFF1B1B1B.toInt()
        private const val DARK_TEXT_MUTED = 0xFF5F6368.toInt()
        private const val SKY_DARK_TEXT = 0xFF000000.toInt()
        private const val DARK_SKY_LUMINANCE = 0.035f

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
