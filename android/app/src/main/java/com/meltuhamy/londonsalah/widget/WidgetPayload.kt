package com.meltuhamy.londonsalah.widget

import org.json.JSONException
import org.json.JSONObject

/**
 * The payload the app writes, as the widgets see it.
 *
 * Deliberately dumb. Everything that could be got wrong about prayer times -
 * which day's row, which asr column, which timezone - was decided in
 * TypeScript, where it is tested. `time` values are display strings that go
 * straight into a TextView; `at` values are UTC instants used only as the
 * countdown's base. Nothing here does date arithmetic.
 */
data class WidgetPrayer(val name: String, val time: String)

/** `day` indexes [WidgetPayload.days]: the day this prayer belongs to. */
data class WidgetUpcoming(val name: String, val at: Long, val time: String, val day: Int)

/**
 * `sky` is the day's ten sky points as UTC instants, in the order
 * [WidgetPayload.skyColours] lists their colours - what WidgetSky works from.
 */
data class WidgetDay(
    val dateLabel: String,
    val prayers: List<WidgetPrayer>,
    val sky: LongArray
)

data class WidgetPayload(
    val locationLabel: String,
    val days: List<WidgetDay>,
    val upcoming: List<WidgetUpcoming>,
    val skyColours: List<SkyColours>
) {
    /** The sky a Sky widget draws at this instant, or null with no days to draw it from. */
    fun skyAt(nowMillis: Long): SkyState? =
        if (days.isEmpty()) null else WidgetSky.at(nowMillis, days.map { it.sky }, skyColours)

    /** The first prayer still ahead, or null once the written window runs out. */
    fun nextAfter(nowMillis: Long): WidgetUpcoming? =
        upcoming.firstOrNull { it.at > nowMillis }

    /**
     * The day a widget shows: the one the next prayer is on. So after Isha
     * it is already tomorrow, as in the app - and a widget left alone for a
     * week moves on by itself rather than keeping the day the app was last
     * opened on.
     */
    fun dayOf(next: WidgetUpcoming): WidgetDay? = days.getOrNull(next.day)

    companion object {
        /** A day's sky points: SKY_PHASES in src/lib/sky.ts. */
        const val SKY_POINTS = 10

        /** Must match WIDGET_PAYLOAD_VERSION in src/lib/widgetPayload.ts. */
        const val SUPPORTED_VERSION = 4

        /**
         * Returns null for anything unusable - absent, malformed, or written
         * by a version that does not match. Showing nothing is right here:
         * a wrong prayer time is worse than a widget asking to be opened.
         */
        fun parse(json: String?): WidgetPayload? {
            if (json.isNullOrBlank()) return null
            return try {
                val root = JSONObject(json)
                if (root.optInt("version", -1) != SUPPORTED_VERSION) return null

                val daysJson = root.getJSONArray("days")
                val days = (0 until daysJson.length()).map { d ->
                    val day = daysJson.getJSONObject(d)
                    val prayersJson = day.getJSONArray("prayers")
                    val skyJson = day.getJSONArray("sky")
                    WidgetDay(
                        day.getString("dateLabel"),
                        (0 until prayersJson.length()).map { i ->
                            val p = prayersJson.getJSONObject(i)
                            WidgetPrayer(p.getString("name"), p.getString("time"))
                        },
                        LongArray(skyJson.length()) { skyJson.getLong(it) }
                    )
                }

                val upcomingJson = root.getJSONArray("upcoming")
                val upcoming = (0 until upcomingJson.length()).map { i ->
                    val u = upcomingJson.getJSONObject(i)
                    WidgetUpcoming(
                        u.getString("name"),
                        u.getLong("at"),
                        u.getString("time"),
                        u.getInt("day")
                    )
                }

                val coloursJson = root.getJSONArray("skyColours")
                val skyColours = (0 until coloursJson.length()).map { i ->
                    val c = coloursJson.getJSONObject(i)
                    SkyColours(c.getString("top"), c.getString("mid"), c.getString("horizon"))
                }
                // The sky needs a whole day of points and a colour for each;
                // anything less is a payload this version cannot draw.
                if (skyColours.size != SKY_POINTS ||
                    days.any { it.sky.size != SKY_POINTS }
                ) return null

                WidgetPayload(
                    locationLabel = root.getString("locationLabel"),
                    days = days,
                    upcoming = upcoming,
                    skyColours = skyColours
                )
            } catch (e: JSONException) {
                null
            }
        }
    }
}
