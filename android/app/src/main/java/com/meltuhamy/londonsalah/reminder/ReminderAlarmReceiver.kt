package com.meltuhamy.londonsalah.reminder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fires one reminder, then arms the next two days. The same receiver also
 * hears boot, an app update, and a clock or time zone change, and on those
 * it only rearms - there is no reminder to post.
 */
class ReminderAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent == null) return
        // Off the main thread: reading and parsing the list can take longer
        // than a broadcast should block it for on a slow phone.
        val pending = goAsync()
        val appContext = context.applicationContext
        Thread {
            try {
                ReminderAlarms.handle(appContext, intent, System.currentTimeMillis())
            } finally {
                pending.finish()
            }
        }.start()
    }
}
