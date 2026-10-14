package com.meltuhamy.londonsalah

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
class LegacyReminderAlarmsTest {

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val alarmManager =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private fun setAlarm(requestCode: Int) {
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.set(AlarmManager.RTC, Long.MAX_VALUE / 2, pendingIntent)
    }

    private fun scheduledCount() =
        shadowOf(alarmManager).scheduledAlarms.size

    @Test
    @Config(sdk = [34])
    fun clearsEveryAlarmTheFirstTime() {
        setAlarm(0)
        setAlarm(63)

        LegacyReminderAlarms.clearOnce(context)

        assertEquals(0, scheduledCount())
    }

    // The web layer reschedules straight after; a second launch clearing
    // again would cancel those and anything set since.
    @Test
    @Config(sdk = [34])
    fun leavesLaterAlarmsAlone() {
        LegacyReminderAlarms.clearOnce(context)
        setAlarm(0)

        LegacyReminderAlarms.clearOnce(context)

        assertEquals(1, scheduledCount())
    }

    @Test
    @Config(sdk = [33])
    fun doesNothingBeforeCancelAllExists() {
        setAlarm(0)

        LegacyReminderAlarms.clearOnce(context)

        assertEquals(1, scheduledCount())
    }
}
