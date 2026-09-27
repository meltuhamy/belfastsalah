package com.meltuhamy.londonsalah.widget

/**
 * A day of prayer times as the app would hand them to the widgets, for both
 * the JVM tests and the ones on a device.
 *
 * 15 January 2026 in London, read out of src/prayer_data/london-2026.json.
 * January is on GMT, so the clock strings are the UTC ones and the instants
 * below can be checked against the file by eye.
 *
 * Deliberately not 15 February. The layouts carry that day's times as sample
 * text for the widget picker, with Duhr highlighted, so a test using the same
 * day could pass on the placeholders of a widget the renderer never touched.
 */
object PayloadFixture {

    val NAMES = listOf("Fajr", "Shuruq", "Duhr", "Asr", "Maghrib", "Isha")
    val TIMES = listOf("06:20", "07:57", "12:15", "14:01", "16:23", "18:00")

    const val FAJR = 0
    const val DUHR = 2
    const val ASR = 3
    const val MAGHRIB = 4

    const val LOCATION = "London"
    const val DATE = "Thu 15 Jan"

    private const val MINUTE = 60_000L
    private const val HOUR = 60 * MINUTE

    /** Midnight at the start of 15 January 2026, UTC. */
    private const val JAN_15 = 1_768_435_200_000L

    /** Fajr on the 16th, 06:19 - the prayer after the last one on the 15th. */
    private const val JAN_16_FAJR = 1_768_544_340_000L

    /** The instant a "HH:mm" clock string names on the 15th. */
    fun on15th(clock: String): Long {
        val (h, m) = clock.split(":").map { it.toInt() }
        return JAN_15 + h * HOUR + m * MINUTE
    }

    /**
     * Half a second before each moment below, so a countdown to a whole
     * minute has half a second to spare.
     *
     * Chronometer truncates: it shows 1:00:59 the instant a hair less than
     * 1:01:00 remains. Its reading is taken when the view is drawn, a moment
     * after the renderer worked out the time left, so aiming exactly at the
     * second made the text - and every screenshot with a countdown in it -
     * depend on how long that moment happened to be.
     */
    private const val SPARE = 500L

    /** 13:00 - Duhr has gone, Asr is next at 14:01, "1:01:00" away. */
    val ONE_PM = on15th("13:00") - SPARE

    /** 15:00 - Maghrib is next: the longest name, in "Maghrib in". */
    val THREE_PM = on15th("15:00") - SPARE

    /** 18:01 - after Isha, so the next prayer is tomorrow's Fajr, "12:18:00" away. */
    val AFTER_ISHA = on15th("18:01") - SPARE

    /** The payload for the 15th, with tomorrow's Fajr as the last upcoming prayer. */
    fun forJan15(): String {
        val upcoming = NAMES.indices.map { i ->
            Triple(NAMES[i], on15th(TIMES[i]), TIMES[i])
        } + Triple("Fajr", JAN_16_FAJR, "06:19")
        return json(upcoming)
    }

    /**
     * The same day's names and clock strings, with the instants moved so that
     * `next` is due `inMillis` after `now` and the rest follow it.
     *
     * For tests on a device, where the widgets read the real clock and a fixed
     * date would already be in the past.
     */
    fun relativeTo(now: Long, next: Int, inMillis: Long = 2 * HOUR): String {
        val upcoming = (next until NAMES.size).map { i ->
            Triple(NAMES[i], now + inMillis + (i - next) * HOUR, TIMES[i])
        }
        return json(upcoming)
    }

    private fun json(upcoming: List<Triple<String, Long, String>>): String {
        val prayers = NAMES.indices.joinToString(",") { i ->
            """{"name":"${NAMES[i]}","time":"${TIMES[i]}"}"""
        }
        val next = upcoming.joinToString(",") { (name, at, time) ->
            """{"name":"$name","at":$at,"time":"$time"}"""
        }
        return """
            {
              "version": ${WidgetPayload.SUPPORTED_VERSION},
              "generatedAt": 0,
              "locationLabel": "$LOCATION",
              "today": { "dateLabel": "$DATE", "prayers": [$prayers] },
              "upcoming": [$next]
            }
        """.trimIndent()
    }
}
