package com.meltuhamy.londonsalah.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fires at each prayer time so the widget can move on to the next one.
 *
 * The countdown itself needs no help - the launcher ticks a Chronometer on its
 * own - so this runs six times a day rather than every second, and only to
 * swap which prayer is being counted down to.
 */
class WidgetAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        WidgetUpdater.refreshAll(context)
        WidgetAlarms.scheduleNextBoundary(context)
    }
}
