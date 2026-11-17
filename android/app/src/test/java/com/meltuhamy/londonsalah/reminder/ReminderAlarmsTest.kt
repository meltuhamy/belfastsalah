package com.meltuhamy.londonsalah.reminder

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher
import com.meltuhamy.londonsalah.widget.WidgetAlarmReceiver
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowAlarmManager
import java.time.Instant

/**
 * The re-plan against the lists TypeScript writes.
 *
 * The instants in the fixtures already include the 2026 clock changes. This
 * only checks that a pinned [nowMillis] arms the right slice of them, and
 * that doing it again does not add a second set.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class ReminderAlarmsTest {

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val alarmManager =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    @Before
    fun clearStoredList() {
        ReminderStore.clear(context)
        ReminderAlarms.replan(context, 0)
    }

    @Test
    fun `reads the spring fixture the app would write`() {
        val payload = fixture("london-spring-2026-03-28.json")

        assertEquals(1, ReminderPayload.SUPPORTED_VERSION)
        assertEquals(Instant.parse("2026-03-28T00:00:00Z").toEpochMilli(), payload.generatedAt)
        assertEquals("Prayer reminders stop here", payload.reminders.last().title)
        assertEquals("Open the app to keep them coming.", payload.reminders.last().body)
        // 28 March 2026, still GMT. Fajr is 04:09, reminded five minutes before.
        // The next morning's title is "Fajr is at 05:07": the UK has sprung
        // forward, and that jump is already in the instant below, not something
        // this side calculates.
        assertEquals(1_774_670_640_000L, payload.reminders.first().at)
        assertEquals("Fajr is at 04:09", payload.reminders.first().title)
        assertEquals("5 minute reminder", payload.reminders.first().body)
        // A field short of the shape is not a list to arm.
        assertNull(ReminderPayload.parse(fixtureText("london-spring-2026-03-28.json").replace("\"title\"", "\"name\"")))
    }

    @Test
    fun `arms the next 48 hours of the spring fixture, including across the clock change`() {
        val payload = stored("london-spring-2026-03-28.json")
        val now = payload.generatedAt

        ReminderAlarms.replan(context, now)

        // The list is gzipped on disk. 1f 8b is the gzip magic number.
        val storedBytes = java.io.File(context.filesDir, "reminders.json").readBytes()
        assertEquals(0x1f, storedBytes[0].toInt() and 0xff)
        assertEquals(0x8b, storedBytes[1].toInt() and 0xff)

        assertEquals(expectedFires(payload, now), fireTimes())
        assertEquals(listOf(now + ReminderAlarms.BACKSTOP_MILLIS), backstopTimes())
        assertTrue(fireTimes().all { it - now <= ReminderAlarms.WINDOW_MILLIS })
        // The prompt is the last thing written, days past this window.
        assertFalse(fireTimes().contains(payload.reminders.last().at))
        assertEquals(AlarmManager.RTC_WAKEUP, alarmTypes().distinct().single())

        // 01:30 UTC on 29 March 2026 is half an hour after the UK springs forward.
        val across = Instant.parse("2026-03-29T01:30:00Z").toEpochMilli()
        ReminderAlarms.replan(context, across)
        assertEquals(expectedFires(payload, across), fireTimes())
        assertEquals(listOf(across + ReminderAlarms.BACKSTOP_MILLIS), backstopTimes())
    }

    @Test
    fun `arms the next 48 hours of the autumn fixture, including across the clock change`() {
        val payload = stored("london-autumn-2026-10-24.json")
        val now = payload.generatedAt

        ReminderAlarms.replan(context, now)
        assertEquals(expectedFires(payload, now), fireTimes())

        // 01:30 UTC on 25 October 2026 is half an hour after the UK falls back.
        val across = Instant.parse("2026-10-25T01:30:00Z").toEpochMilli()
        ReminderAlarms.replan(context, across)
        ReminderAlarms.replan(context, across)
        assertEquals(expectedFires(payload, across), fireTimes())
        assertEquals(1, backstopTimes().size)
    }

    @Test
    fun `leaves no alarms when reminders are turned off`() {
        stored("london-spring-2026-03-28.json")
        ReminderAlarms.replan(context, Instant.parse("2026-03-28T00:00:00Z").toEpochMilli())
        assertTrue(fireTimes().isNotEmpty())

        ReminderStore.clear(context)
        ReminderAlarms.replan(context, Instant.parse("2026-03-28T00:00:00Z").toEpochMilli())

        assertTrue(fireTimes().isEmpty())
        assertTrue(backstopTimes().isEmpty())
        assertTrue(shadowOf(alarmManager).scheduledAlarms.isEmpty())
    }

    @Test
    fun `a second replan replaces the window instead of adding to it`() {
        val payload = stored("london-spring-2026-03-28.json")
        val now = payload.generatedAt

        ReminderAlarms.replan(context, now)
        val once = fireTimes()
        ReminderAlarms.replan(context, now)
        ReminderAlarms.replan(context, now)

        assertEquals(once, fireTimes())
        assertEquals(once.distinct(), once)
        assertEquals(1, backstopTimes().size)
        assertTrue(once.size < ReminderAlarms.SLOT_COUNT)
    }

    @Test
    fun `does not cancel the widget redraw alarm`() {
        val widget = PendingIntent.getBroadcast(
            context,
            8100,
            Intent(context, WidgetAlarmReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC, 5_000, widget)

        stored("london-spring-2026-03-28.json")
        ReminderAlarms.replan(context, Instant.parse("2026-03-28T00:00:00Z").toEpochMilli())

        val stillThere = shadowOf(alarmManager).scheduledAlarms.any { alarm ->
            shadowOf(alarm.operation).savedIntent.component?.className ==
                WidgetAlarmReceiver::class.java.name
        }
        assertTrue(stillThere)
    }

    @Test
    fun `posts the reminder that fired and does not arm it again`() {
        val payload = stored("london-spring-2026-03-28.json")
        val entry = payload.reminders.first()
        val intent = Intent(ReminderAlarms.ACTION_FIRE)
            .putExtra(ReminderAlarms.EXTRA_AT, entry.at)
            .putExtra(ReminderAlarms.EXTRA_TITLE, entry.title)
            .putExtra(ReminderAlarms.EXTRA_BODY, entry.body)

        ReminderAlarms.handle(context, intent, entry.at)
        ReminderAlarms.handle(context, intent, entry.at)

        val notifications =
            context.getSystemService(NotificationManager::class.java)
        val posted = shadowOf(notifications).allNotifications
        assertEquals(
            listOf(entry.title),
            posted.map { notification -> notification.extras.getString(Notification.EXTRA_TITLE) }
        )
        assertFalse(fireTimes().contains(entry.at))
        assertEquals(expectedFires(payload, entry.at), fireTimes())
    }

    @Test
    fun `still arms the window when exact alarms are not allowed`() {
        ShadowAlarmManager.setCanScheduleExactAlarms(false)
        val payload = stored("london-spring-2026-03-28.json")

        ReminderAlarms.replan(context, payload.generatedAt)

        assertEquals(expectedFires(payload, payload.generatedAt), fireTimes())
    }

    @Test
    fun `cancels the plugin batch and leaves the test notification`() {
        val prefs = context.getSharedPreferences("NOTIFICATION_STORE", Context.MODE_PRIVATE)
        prefs.edit()
            .putString("4", """{"id":4}""")
            .putString("9999", """{"id":9999}""")
            .commit()
        armPlugin(4, 4_000)
        armPlugin(9999, 9_999)

        PluginReminderMigration.cancel(context)

        val remaining = shadowOf(alarmManager).scheduledAlarms.map { alarm ->
            shadowOf(alarm.operation).requestCode
        }
        assertFalse(remaining.contains(4))
        assertTrue(remaining.contains(9999))
        assertFalse(prefs.contains("4"))
        assertEquals("""{"id":9999}""", prefs.getString("9999", null))
    }

    private fun armPlugin(id: Int, at: Long) {
        val pending = PendingIntent.getBroadcast(
            context,
            id,
            Intent(context, TimedNotificationPublisher::class.java),
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
    }

    private fun stored(name: String): ReminderPayload {
        val text = fixtureText(name)
        ReminderStore.write(context, text)
        return ReminderPayload.parse(text)!!
    }

    private fun fixture(name: String): ReminderPayload =
        ReminderPayload.parse(fixtureText(name))!!

    private fun fixtureText(name: String): String =
        javaClass.classLoader!!.getResource(name)!!.readText()

    private fun expectedFires(payload: ReminderPayload, now: Long): List<Long> =
        payload.dueWithin(now, ReminderAlarms.WINDOW_MILLIS).map { it.at }

    private fun fireTimes(): List<Long> = alarmsFor(ReminderAlarms.ACTION_FIRE).map { it.first }

    private fun backstopTimes(): List<Long> =
        alarmsFor(ReminderAlarms.ACTION_BACKSTOP).map { it.first }

    private fun alarmTypes(): List<Int> =
        shadowOf(alarmManager).scheduledAlarms.map { it.type }

    private fun alarmsFor(action: String): List<Pair<Long, Intent>> =
        shadowOf(alarmManager).scheduledAlarms.mapNotNull { alarm ->
            val intent = shadowOf(alarm.operation).savedIntent
            if (intent.action != action) null else alarm.triggerAtMs to intent
        }.sortedBy { it.first }
}
