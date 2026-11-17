package com.meltuhamy.londonsalah.reminder

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.MediumTest
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A reminder still armed, and firing, forty days after it was written.
 *
 * The list is stored and the next two days are armed. The clock then jumps,
 * without the app being opened, and the manifest receiver is what rearms the
 * window the jump landed in. The clock is put back afterwards: this shares
 * an emulator with the widget tests.
 */
@RunWith(AndroidJUnit4::class)
@MediumTest
class ReminderRearmDeviceTest {

    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context: Context = instrumentation.targetContext
    private val notifications =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private var originalTime = 0L
    private var originalAutoTime = "1"

    @Before
    fun holdTheClock() {
        originalAutoTime = shell("settings get global auto_time").ifBlank { "1" }
        shell("settings put global auto_time 0")
        shell("pm grant ${context.packageName} android.permission.POST_NOTIFICATIONS")
        originalTime = System.currentTimeMillis()
        ReminderStore.clear(context)
        notifications.cancelAll()
    }

    @After
    fun restoreTheClock() {
        ReminderStore.clear(context)
        ReminderAlarms.replan(context, System.currentTimeMillis())
        notifications.cancelAll()
        setTime(originalTime)
        shell("settings put global auto_time $originalAutoTime")
    }

    @Test
    fun aReminderFortyDaysOutIsArmedAndFires() {
        val now = System.currentTimeMillis()
        val soon = now + 60 * 60 * 1000
        val far = now + 40L * 24 * 60 * 60 * 1000 + 30_000
        val later = far + 2 * 60 * 60 * 1000
        ReminderStore.write(
            context,
            """
            {"version":1,"generatedAt":$now,"reminders":[
              {"at":$soon,"title":"Soon","body":"an hour out"},
              {"at":$far,"title":"Forty days on","body":"still armed"},
              {"at":$later,"title":"Still going","body":"the one after"}
            ]}
            """.trimIndent()
        )
        ReminderAlarms.replan(context, now)

        val armed = triggers()
        assertTrue("the near reminder is armed\n${dump()}", armed.any { near(it, soon) })
        assertFalse("forty days out is not armed yet\n${dump()}", armed.any { near(it, far) })

        // Land just before the far reminder. Nothing in the app is opened;
        // TIME_SET is what should rearm.
        setTime(far - 20_000)
        waitUntil("the far reminder to be armed") {
            val times = triggers()
            times.any { near(it, far) } && times.none { near(it, soon) }
        }
        val afterJump = triggers().filter { near(it, far) }
        assertEquals("one alarm for the far reminder, not a duplicate\n${dump()}", 1, afterJump.size)

        setTime(far + 5_000)
        waitUntil("the far reminder to fire") {
            notifications.activeNotifications.any { notification ->
                notification.notification.extras.getString(Notification.EXTRA_TITLE) == "Forty days on"
            }
        }
    }

    private fun near(actual: Long, expected: Long): Boolean = kotlin.math.abs(actual - expected) < 2_000

    private fun triggers(): List<Long> {
        // API 33 prints the epoch on the Alarm{ line and the action on the
        // tag line under it: "origWhen 1794980040000" then
        // "tag=*walarm*:com.meltuhamy.londonsalah.REMINDER_FIRE".
        val lines = dump().lines()
        val times = mutableListOf<Long>()
        for (i in lines.indices) {
            if (!lines[i].contains("REMINDER_FIRE")) continue
            val block = listOfNotNull(lines.getOrNull(i - 1), lines[i]).joinToString("\n")
            val match = ORIGIN.find(block) ?: continue
            times.add(match.groupValues[1].toLong())
        }
        return times
    }

    private fun dump(): String = shell("dumpsys alarm")

    private fun setTime(millis: Long) {
        val output = shell("cmd alarm set-time $millis")
        if (kotlin.math.abs(System.currentTimeMillis() - millis) > 5_000) {
            shell("date @${millis / 1000}")
        }
        if (kotlin.math.abs(System.currentTimeMillis() - millis) > 5_000) {
            fail("Could not set the clock to $millis (now ${System.currentTimeMillis()}): $output")
        }
    }

    private fun waitUntil(what: String, timeoutMs: Long = 20_000, check: () -> Boolean) {
        val deadline = SystemClock.elapsedRealtime() + timeoutMs
        while (SystemClock.elapsedRealtime() < deadline) {
            if (check()) return
            SystemClock.sleep(200)
        }
        fail("Timed out after ${timeoutMs}ms waiting for $what\n${dump()}")
    }

    private fun shell(command: String): String {
        val output = instrumentation.uiAutomation.executeShellCommand(command)
        return ParcelFileDescriptor.AutoCloseInputStream(output).use {
            it.readBytes().toString(Charsets.UTF_8).trim()
        }
    }

    companion object {
        private val ORIGIN = Regex("""origWhen (\d{12,})""")
    }
}
