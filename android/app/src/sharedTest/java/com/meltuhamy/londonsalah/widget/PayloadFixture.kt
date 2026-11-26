package com.meltuhamy.londonsalah.widget

/**
 * A day of prayer times as the app would hand them to the widgets, for both
 * the JVM tests and the ones on a device.
 *
 * 15 January 2026 in London, read out of src/prayer_data/london-2026.json as
 * it was before the official timetable replaced it - a minute off that file in
 * places now, which nothing here depends on: the tests only compare the
 * widgets against these values. January is on GMT, so the clock strings are
 * the UTC ones.
 *
 * Deliberately not 15 February. The layouts carry that day's times as sample
 * text for the widget picker, with Duhr highlighted, so a test using the same
 * day could pass on the placeholders of a widget the renderer never touched.
 */
object PayloadFixture {

    val NAMES = listOf("Fajr", "Shuruq", "Duhr", "Asr", "Maghrib", "Isha")
    val TIMES = listOf("06:20", "07:57", "12:15", "14:01", "16:23", "18:00")

    /**
     * The same day on a 12-hour clock. The app writes these strings, so this is
     * what the widgets have to draw when the time format setting is 12-hour:
     * no AM or PM, since the prayer's name already says which half of the day.
     */
    val TIMES_12 = listOf("6:20", "7:57", "12:15", "2:01", "4:23", "6:00")

    const val FAJR = 0
    const val DUHR = 2
    const val ASR = 3
    const val MAGHRIB = 4

    const val LOCATION = "London"
    const val DATE = "Thu 15 Jan"

    /** The 16th, which a widget shows once the 15th's Isha has gone. */
    val TOMORROW_TIMES = listOf("06:19", "07:56", "12:15", "14:03", "16:25", "18:02")
    val TOMORROW_TIMES_12 =
        listOf("6:19", "7:56", "12:15", "2:03", "4:25", "6:02")
    const val TOMORROW_DATE = "Fri 16 Jan"

    /**
     * The sky points' colours, as src/lib/sky.ts sends them - copied from
     * fixtures/widget-payload, which TypeScript writes.
     */
    const val SKY_COLOURS =
        """[{"top":"#070b1e","mid":"#0e1534","horizon":"#1a2350"},{"top":"#1b2452","mid":"#4b3f7a","horizon":"#95566e"},{"top":"#7d9bd1","mid":"#e9b8a6","horizon":"#ffd08a"},{"top":"#5aa3e8","mid":"#8cc4f0","horizon":"#cde8fa"},{"top":"#4f9ae4","mid":"#7dbbef","horizon":"#b9def8"},{"top":"#68a2da","mid":"#a9c9de","horizon":"#f2d7a2"},{"top":"#7d97cc","mid":"#e3a27a","horizon":"#f7b866"},{"top":"#2b2f66","mid":"#7e4373","horizon":"#a9492b"},{"top":"#121a3e","mid":"#26285c","horizon":"#4b3a74"},{"top":"#070b1e","mid":"#0e1534","horizon":"#1a2350"}]"""

    private const val MINUTE = 60_000L
    private const val HOUR = 60 * MINUTE

    /** Midnight at the start of 15 January 2026, UTC. */
    private const val JAN_15 = 1_768_435_200_000L

    /** Fajr on the 16th, 06:19 - the prayer after the last one on the 15th. */
    private const val JAN_16_FAJR = 1_768_544_340_000L

    /** Midnight at the start of 16 January 2026, UTC. */
    private const val JAN_16 = JAN_15 + 24 * HOUR

    /**
     * A day's ten sky points from its six prayer instants, as skyPoints in
     * src/lib/sky.ts places them: an hour before Fajr, the prayers, ninety
     * minutes after Shuruq, 25 minutes before Maghrib, ninety after Isha.
     */
    fun skyTimes(prayers: List<Long>): List<Long> {
        val (fajr, shuruq, duhr, asr, maghrib) = prayers
        val isha = prayers[5]
        return listOf(
            fajr - 60 * MINUTE, fajr, shuruq, shuruq + 90 * MINUTE, duhr, asr,
            maghrib - 25 * MINUTE, maghrib, isha, isha + 90 * MINUTE
        )
    }

    private fun instants(midnight: Long, clocks: List<String>): List<Long> =
        clocks.map { clock ->
            val (h, m) = clock.split(":").map { it.toInt() }
            midnight + h * HOUR + m * MINUTE
        }

    private val SKY_15TH = skyTimes(instants(JAN_15, TIMES))
    private val SKY_16TH = skyTimes(instants(JAN_16, TOMORROW_TIMES))

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

    /** 06:05 - Fajr is next at 06:20: the Sky widget's haze, with the thread in it. */
    val BEFORE_FAJR = on15th("06:05") - SPARE

    /** 07:35 - Shuruq is next at 07:57: no sun yet, only the dawn glow. */
    val BEFORE_SUNRISE = on15th("07:35") - SPARE

    /** 11:00 - Duhr is next at 12:15: its highlight beside the plain columns. */
    val ELEVEN_AM = on15th("11:00") - SPARE

    /** 13:00 - Duhr has gone, Asr is next at 14:01, "1:01:00" away. */
    val ONE_PM = on15th("13:00") - SPARE

    /** 15:00 - Maghrib is next: the longest name, in "Maghrib in". */
    val THREE_PM = on15th("15:00") - SPARE

    /** 16:30 - just after Maghrib at 16:23, under the sunset sky. */
    val SUNSET = on15th("16:30") - SPARE

    /** 18:01 - after Isha, so the next prayer is tomorrow's Fajr, "12:18:00" away. */
    val AFTER_ISHA = on15th("18:01") - SPARE

    /** The payload for the 15th, with tomorrow's Fajr as the last upcoming prayer. */
    fun forJan15(): String {
        val upcoming = NAMES.indices.map { i ->
            Upcoming(NAMES[i], on15th(TIMES[i]), TIMES[i], day = 0)
        } + Upcoming("Fajr", JAN_16_FAJR, TOMORROW_TIMES[FAJR], day = 1)
        return json(
            listOf(Day(DATE, TIMES, SKY_15TH), Day(TOMORROW_DATE, TOMORROW_TIMES, SKY_16TH)),
            upcoming
        )
    }

    /**
     * The same day's names and clock strings, with the instants moved so that
     * `next` is due `inMillis` after `now` and the rest follow it.
     *
     * For tests on a device, where the widgets read the real clock and a fixed
     * date would already be in the past.
     */
    /** The 15th's payload on a 12-hour clock. */
    fun forJan15TwelveHour(): String {
        val upcoming = NAMES.indices.map { i ->
            Upcoming(NAMES[i], on15th(TIMES[i]), TIMES_12[i], day = 0)
        } + Upcoming("Fajr", JAN_16_FAJR, TOMORROW_TIMES_12[FAJR], day = 1)
        return json(
            listOf(
                Day(DATE, TIMES_12, SKY_15TH),
                Day(TOMORROW_DATE, TOMORROW_TIMES_12, SKY_16TH)
            ),
            upcoming
        )
    }

    fun relativeTo(now: Long, next: Int, inMillis: Long = 2 * HOUR): String {
        val instants = NAMES.indices.map { i -> now + inMillis + (i - next) * HOUR }
        val upcoming = (next until NAMES.size).map { i ->
            Upcoming(NAMES[i], instants[i], TIMES[i], day = 0)
        }
        return json(listOf(Day(DATE, TIMES, skyTimes(instants))), upcoming)
    }

    private data class Upcoming(val name: String, val at: Long, val time: String, val day: Int)

    private data class Day(val date: String, val times: List<String>, val sky: List<Long>)

    private fun json(days: List<Day>, upcoming: List<Upcoming>): String {
        val dayJson = days.joinToString(",") { (date, times, sky) ->
            val prayers = NAMES.indices.joinToString(",") { i ->
                """{"name":"${NAMES[i]}","time":"${times[i]}"}"""
            }
            """{"dateLabel":"$date","prayers":[$prayers],"sky":[${sky.joinToString(",")}]}"""
        }
        val next = upcoming.joinToString(",") { (name, at, time, day) ->
            """{"name":"$name","at":$at,"time":"$time","day":$day}"""
        }
        return """
            {
              "version": ${WidgetPayload.SUPPORTED_VERSION},
              "generatedAt": 0,
              "locationLabel": "$LOCATION",
              "days": [$dayJson],
              "upcoming": [$next],
              "skyColours": $SKY_COLOURS
            }
        """.trimIndent()
    }
}
