package com.meltuhamy.londonsalah.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent

object WidgetAlarms {
    private const val REQUEST_CODE = 8100
    private const val SKY_REQUEST_CODE = 8101

    /**
     * How often a Sky widget is redrawn between prayers. The sun moves about
     * a fortieth of the widget's width in that time, so it glides rather than
     * jumps - and the alarm does not wake the phone (see scheduleSkyTick).
     */
    const val SKY_TICK_MILLIS = 15 * 60_000L

    /**
     * Sets one alarm, at the next prayer, to redraw the widgets - and while
     * any widget uses the Sky palette, another for the sky's next quarter of
     * an hour.
     */
    fun scheduleNextBoundary(context: Context) {
        val payload = WidgetPayload.parse(WidgetStore.read(context)) ?: return
        val now = System.currentTimeMillis()
        val next = payload.nextAfter(now) ?: return

        val alarmManager =
            context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            Intent(context, WidgetAlarmReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // The app holds USE_EXACT_ALARM for prayer reminders, so this normally
        // succeeds. On API 31-32 the equivalent permission is revocable, and
        // a widget that redraws late is much better than one that crashes.
        try {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC,
                next.at,
                pendingIntent
            )
        } catch (e: SecurityException) {
            alarmManager.set(AlarmManager.RTC, next.at, pendingIntent)
        }

        scheduleSkyTick(context, alarmManager, now, next.at)
    }

    /**
     * The sky's own redraw, at the next quarter past, half past and so on,
     * while one of the widgets shows it.
     *
     * Plain RTC and inexact on purpose. A non-waking alarm that comes due
     * while the phone sleeps waits for it to wake, and a sleeping phone's
     * home screen is not being looked at - so the sky costs nothing while the
     * screen is off, and is redrawn the moment it comes on. The prayer's own
     * exact alarm above is untouched by this: one never replaces the other.
     */
    private fun scheduleSkyTick(
        context: Context,
        alarmManager: AlarmManager,
        now: Long,
        nextPrayerAt: Long
    ) {
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            SKY_REQUEST_CODE,
            Intent(context, WidgetAlarmReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val anySky = WidgetUpdater.placedIds(context).any {
            WidgetConfig.load(context, it).palette == WidgetPalette.SKY
        }
        val tick = (now / SKY_TICK_MILLIS + 1) * SKY_TICK_MILLIS
        if (!anySky || tick >= nextPrayerAt) {
            alarmManager.cancel(pendingIntent)
            return
        }
        alarmManager.set(AlarmManager.RTC, tick, pendingIntent)
    }
}
