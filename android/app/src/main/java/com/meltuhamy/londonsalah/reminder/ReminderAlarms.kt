package com.meltuhamy.londonsalah.reminder

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Arms the next two days of the stored list, and nothing further out.
 *
 * Request codes stay inside a fixed range, so a re-plan cancels exactly the
 * alarms it set last time and then sets them again. Two calls, or a reminder
 * firing at the same moment as the daily backstop, cannot leave a duplicate.
 * The widget redraw uses 8100; this uses 8200 up.
 *
 * WorkManager is not a dependency of this app. The daily backstop is another
 * exact alarm in this same range, the way the widget chains its own redraw,
 * rather than a new scheduler. If a refill is missed, the next reminder - or
 * that daily alarm - fills the window again.
 */
object ReminderAlarms {
    const val WINDOW_MILLIS = 48L * 60 * 60 * 1000
    const val BACKSTOP_MILLIS = 24L * 60 * 60 * 1000

    /** More than two days of six prayers, so the window is never truncated. */
    const val SLOT_COUNT = 24
    const val SLOT_REQUEST_CODE_BASE = 8200
    const val BACKSTOP_REQUEST_CODE = 8299

    const val ACTION_FIRE = "com.meltuhamy.londonsalah.REMINDER_FIRE"
    const val ACTION_BACKSTOP = "com.meltuhamy.londonsalah.REMINDER_BACKSTOP"
    const val EXTRA_AT = "at"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"

    /**
     * A broadcast from an alarm, or from boot, update, or a clock change.
     *
     * [nowMillis] is the clock the window is chosen against. A firing reminder
     * counts as already passed even if the broadcast arrived a moment early,
     * so it is not armed again.
     */
    fun handle(context: Context, intent: Intent, nowMillis: Long) {
        var now = nowMillis
        if (intent.action == ACTION_FIRE) {
            val at = intent.getLongExtra(EXTRA_AT, Long.MIN_VALUE)
            if (at != Long.MIN_VALUE) {
                ReminderNotifications.show(context, intent)
                if (at > now) now = at
            }
        }
        replan(context, now)
    }

    fun replan(context: Context, nowMillis: Long) {
        val alarmManager =
            context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        cancelArmed(context, alarmManager)

        val payload = ReminderPayload.parse(ReminderStore.read(context)) ?: return
        val upcoming = payload.reminders.filter { it.at > nowMillis }
        if (upcoming.isEmpty()) return

        val due = upcoming.filter { it.at <= nowMillis + WINDOW_MILLIS }.take(SLOT_COUNT)
        due.forEachIndexed { index, reminder ->
            val pending = PendingIntent.getBroadcast(
                context,
                SLOT_REQUEST_CODE_BASE + index,
                fireIntent(context, reminder),
                pendingFlags()
            )
            schedule(alarmManager, reminder.at, pending)
        }
        val backstop = PendingIntent.getBroadcast(
            context,
            BACKSTOP_REQUEST_CODE,
            Intent(context, ReminderAlarmReceiver::class.java).setAction(ACTION_BACKSTOP),
            pendingFlags()
        )
        schedule(alarmManager, nowMillis + BACKSTOP_MILLIS, backstop)
    }

    private fun cancelArmed(context: Context, alarmManager: AlarmManager) {
        for (index in 0 until SLOT_COUNT) {
            cancel(context, alarmManager, SLOT_REQUEST_CODE_BASE + index, ACTION_FIRE)
        }
        cancel(context, alarmManager, BACKSTOP_REQUEST_CODE, ACTION_BACKSTOP)
    }

    private fun cancel(
        context: Context,
        alarmManager: AlarmManager,
        requestCode: Int,
        action: String
    ) {
        val pending = PendingIntent.getBroadcast(
            context,
            requestCode,
            Intent(context, ReminderAlarmReceiver::class.java).setAction(action),
            pendingFlags()
        )
        alarmManager.cancel(pending)
        pending.cancel()
    }

    private fun fireIntent(context: Context, reminder: ReminderEntry): Intent =
        Intent(context, ReminderAlarmReceiver::class.java)
            .setAction(ACTION_FIRE)
            .putExtra(EXTRA_AT, reminder.at)
            .putExtra(EXTRA_TITLE, reminder.title)
            .putExtra(EXTRA_BODY, reminder.body)

    private fun pendingFlags(): Int =
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    /**
     * Exact while-idle when the user allows it, and the plugin's inexact
     * while-idle otherwise. A reminder that arrives late still arrives;
     * one that throws here would also fail to arm the next one.
     */
    private fun schedule(alarmManager: AlarmManager, triggerAt: Long, pending: PendingIntent) {
        val exactAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            alarmManager.canScheduleExactAlarms()
        if (exactAllowed) {
            try {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAt,
                    pending
                )
                return
            } catch (_: SecurityException) {
                // canScheduleExactAlarms can still be followed by a refusal.
            }
        }
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
    }
}
