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

    private fun payloadJson(version: Int = 2, upcoming: String) = """
        {
          "version": $version,
          "generatedAt": 0,
          "locationLabel": "London",
          "today": {
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
          "upcoming": $upcoming
        }
    """.trimIndent()

    @Test
    fun `reads a payload the app wrote`() {
        val payload = WidgetPayload.parse(
            payloadJson(upcoming = """[{ "name": "Duhr", "at": 2000, "time": "12:20" }]""")
        )!!

        assertEquals("London", payload.locationLabel)
        assertEquals("Sun 15 Feb", payload.dateLabel)
        assertEquals(6, payload.prayers.size)
        assertEquals("12:20", payload.prayers[2].time)
        assertEquals("12:20", payload.upcoming[0].time)
    }

    @Test
    fun `picks the first prayer still ahead`() {
        val payload = WidgetPayload.parse(
            payloadJson(
                upcoming = """
                    [{ "name": "Fajr", "at": 1000, "time": "05:36" },
                     { "name": "Duhr", "at": 2000, "time": "12:20" },
                     { "name": "Asr",  "at": 3000, "time": "14:45" }]
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
            payloadJson(upcoming = """[{ "name": "Fajr", "at": 1000, "time": "05:36" }]""")
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
            WidgetPayload.parse(payloadJson(upcoming = """[{ "name": "Fajr", "at": 1000 }]"""))
        )
    }

    @Test
    fun `reads the fixture the render tests draw from`() {
        // If this fails, every render test fails with it for a reason that
        // has nothing to do with drawing - so it is worth saying so here.
        val payload = WidgetPayload.parse(PayloadFixture.forJan15())!!

        assertEquals(PayloadFixture.NAMES, payload.prayers.map { it.name })
        assertEquals("Asr", payload.nextAfter(PayloadFixture.ONE_PM)!!.name)
        assertEquals("Maghrib", payload.nextAfter(PayloadFixture.THREE_PM)!!.name)

        val tomorrow = payload.nextAfter(PayloadFixture.AFTER_ISHA)!!
        assertEquals("Fajr", tomorrow.name)
        assertEquals("06:19", tomorrow.time)
    }

    @Test
    fun `refuses anything it cannot trust`() {
        assertNull(WidgetPayload.parse(null))
        assertNull(WidgetPayload.parse(""))
        assertNull(WidgetPayload.parse("not json"))
        assertNull(WidgetPayload.parse("""{"version":1}"""))
        // A payload from a future version: better to show nothing than to
        // guess at a shape that has changed.
        assertNull(WidgetPayload.parse(payloadJson(version = 99, upcoming = "[]")))
    }
}
