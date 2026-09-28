package com.meltuhamy.londonsalah.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The only logic on the native side worth testing: reading the payload, and
 * picking which prayer is next. Everything else about prayer times was decided
 * in TypeScript, where it is covered far more thoroughly.
 */
class WidgetPayloadTest {

    private fun payloadJson(
        version: Int = WidgetPayload.SUPPORTED_VERSION,
        upcoming: String
    ) = """
        {
          "version": $version,
          "generatedAt": 0,
          "locationLabel": "London",
          "days": [
            {
              "dateLabel": "Sun 15 Feb",
              "prayers": [
                { "name": "Fajr", "time": "05:36" },
                { "name": "Shuruq", "time": "07:13" },
                { "name": "Duhr", "time": "12:20" },
                { "name": "Asr", "time": "14:45" },
                { "name": "Maghrib", "time": "17:18" },
                { "name": "Isha", "time": "18:48" }
              ]
            },
            {
              "dateLabel": "Mon 16 Feb",
              "prayers": [
                { "name": "Fajr", "time": "05:34" },
                { "name": "Shuruq", "time": "07:11" },
                { "name": "Duhr", "time": "12:20" },
                { "name": "Asr", "time": "14:47" },
                { "name": "Maghrib", "time": "17:20" },
                { "name": "Isha", "time": "18:50" }
              ]
            }
          ],
          "upcoming": $upcoming
        }
    """.trimIndent()

    @Test
    fun `reads a payload the app wrote`() {
        val payload = WidgetPayload.parse(
            payloadJson(upcoming = """[{ "name": "Duhr", "at": 2000, "time": "12:20", "day": 0 }]""")
        )!!

        assertEquals("London", payload.locationLabel)
        assertEquals(listOf("Sun 15 Feb", "Mon 16 Feb"), payload.days.map { it.dateLabel })
        assertEquals(6, payload.days[0].prayers.size)
        assertEquals("12:20", payload.days[0].prayers[2].time)
        assertEquals("12:20", payload.upcoming[0].time)
    }

    @Test
    fun `shows the day the next prayer is on`() {
        // After Isha the next prayer is tomorrow's Fajr, so the widget shows
        // tomorrow - and a widget left alone keeps moving on, day by day.
        val payload = WidgetPayload.parse(
            payloadJson(
                upcoming = """
                    [{ "name": "Isha", "at": 1000, "time": "18:48", "day": 0 },
                     { "name": "Fajr", "at": 2000, "time": "05:34", "day": 1 }]
                """.trimIndent()
            )
        )!!

        assertEquals("Sun 15 Feb", payload.dayOf(payload.nextAfter(500)!!)!!.dateLabel)
        assertEquals("Mon 16 Feb", payload.dayOf(payload.nextAfter(1500)!!)!!.dateLabel)
    }

    @Test
    fun `picks the first prayer still ahead`() {
        val payload = WidgetPayload.parse(
            payloadJson(
                upcoming = """
                    [{ "name": "Fajr", "at": 1000, "time": "05:36", "day": 0 },
                     { "name": "Duhr", "at": 2000, "time": "12:20", "day": 0 },
                     { "name": "Asr",  "at": 3000, "time": "14:45", "day": 0 }]
                """.trimIndent()
            )
        )!!

        assertEquals("Duhr", payload.nextAfter(1500)!!.name)
        // Exactly on a prayer time counts as passed, so the widget moves on
        // rather than showing a countdown of zero.
        assertEquals("Duhr", payload.nextAfter(1000)!!.name)
        assertEquals("Fajr", payload.nextAfter(999)!!.name)
    }

    @Test
    fun `reports nothing once the written window runs out`() {
        val payload = WidgetPayload.parse(
            payloadJson(upcoming = """[{ "name": "Fajr", "at": 1000, "time": "05:36", "day": 0 }]""")
        )!!
        assertNull(payload.nextAfter(5000))
    }

    @Test
    fun `reports nothing when nothing was written ahead`() {
        val payload = WidgetPayload.parse(payloadJson(upcoming = "[]"))!!
        assertNull(payload.nextAfter(0))
    }

    @Test
    fun `refuses an entry with a field missing`() {
        // No "time": the widget would have nothing to show in the TIME mode,
        // and half a payload is not one to trust.
        assertNull(
            WidgetPayload.parse(payloadJson(upcoming = """[{ "name": "Fajr", "at": 1000, "day": 0 }]"""))
        )
    }

    @Test
    fun `reads the fixture the render tests draw from`() {
        // If this fails, every render test fails with it for a reason that
        // has nothing to do with drawing - so it is worth saying so here.
        val payload = WidgetPayload.parse(PayloadFixture.forJan15())!!

        assertEquals(PayloadFixture.NAMES, payload.days[0].prayers.map { it.name })
        assertEquals("Asr", payload.nextAfter(PayloadFixture.ONE_PM)!!.name)
        assertEquals("Maghrib", payload.nextAfter(PayloadFixture.THREE_PM)!!.name)

        val tomorrow = payload.nextAfter(PayloadFixture.AFTER_ISHA)!!
        assertEquals("Fajr", tomorrow.name)
        assertEquals("06:19", tomorrow.time)
        assertEquals(PayloadFixture.TOMORROW_DATE, payload.dayOf(tomorrow)!!.dateLabel)
    }

    @Test
    fun `refuses anything it cannot trust`() {
        assertNull(WidgetPayload.parse(null))
        assertNull(WidgetPayload.parse(""))
        assertNull(WidgetPayload.parse("not json"))
        assertNull(WidgetPayload.parse("""{"version":1}"""))
        // The previous version's shape, with one "today" and no "days".
        assertNull(WidgetPayload.parse(payloadJson(upcoming = "[]").replace("\"days\"", "\"today\"")))
        // A payload from a future version: better to show nothing than to
        // guess at a shape that has changed.
        assertNull(WidgetPayload.parse(payloadJson(version = 99, upcoming = "[]")))
    }
}
