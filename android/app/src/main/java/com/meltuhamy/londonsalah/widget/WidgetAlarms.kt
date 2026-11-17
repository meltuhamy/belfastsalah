package com.meltuhamy.londonsalah.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent

object WidgetAlarms {
    private const val REQUEST_CODE = 8100

    /** Sets one alarm, at the next prayer, to redraw the widgets. */
    fun scheduleNextBoundary(context: Context) {
        val payload = WidgetPayload.parse(WidgetStore.read(context)) ?: return
        val next = payload.nextAfter(System.currentTimeMillis()) ?: return

        val alarmManager =
            context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            Intent(context, WidgetAlarmReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // SCHEDULE_EXACT_ALARM is revocable from API 31, and a new install on
        // Android 14+ starts without it. A widget that redraws late is much
        // better than one that crashes.
        try {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC,
                next.at,
                pendingIntent
            )
        } catch (e: SecurityException) {
            alarmManager.set(AlarmManager.RTC, next.at, pendingIntent)
        }
    }
}
