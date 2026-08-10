package com.meltuhamy.londonsalah.widget

import android.content.Context
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import com.meltuhamy.londonsalah.R

/**
 * Draws the countdown, in whichever of the three forms the widget is set to.
 *
 * There is deliberately no "count down without seconds". Chronometer is what
 * makes the live version free - the launcher ticks it in its own process, with
 * no wakeups - and it has no format that omits seconds. Doing it ourselves
 * would mean redrawing every minute, which widgets cannot do cheaply: the
 * minimum automatic period is 30 minutes, ACTION_TIME_TICK does not reach
 * manifest receivers, and a per-minute alarm is 1,440 a day for cosmetics.
 * Showing the prayer's clock time is the honest alternative.
 */
object WidgetCountdown {

    /**
     * `labelWithVerb` reads "Duhr in" / "Duhr at", which is right when the
     * label introduces the countdown below it. Off, the label is the prayer's
     * name alone - for layouts where the name is the headline and the countdown
     * is the small print above it.
     */
    fun bind(
        views: RemoteViews,
        context: Context,
        config: WidgetConfig,
        next: WidgetUpcoming,
        countdownViewId: Int,
        labelViewId: Int,
        labelWithVerb: Boolean = true
    ) {
        when (config.countdown) {
            CountdownMode.SECONDS -> {
                views.setViewVisibility(countdownViewId, View.VISIBLE)
                views.setTextViewText(
                    labelViewId,
                    if (labelWithVerb) {
                        context.getString(R.string.widget_next_in, next.name)
                    } else {
                        next.name
                    }
                )
                // Chronometer counts in the elapsedRealtime timebase, not wall
                // clock, so the instant has to be converted into it.
                val base =
                    SystemClock.elapsedRealtime() + (next.at - System.currentTimeMillis())
                views.setChronometer(countdownViewId, base, null, true)
                views.setChronometerCountDown(countdownViewId, true)
            }

            CountdownMode.TIME -> {
                views.setViewVisibility(countdownViewId, View.VISIBLE)
                views.setTextViewText(
                    labelViewId,
                    if (labelWithVerb) {
                        context.getString(R.string.widget_next_at, next.name)
                    } else {
                        next.name
                    }
                )
                // Stop it first: a running Chronometer would overwrite the text.
                views.setChronometer(
                    countdownViewId, SystemClock.elapsedRealtime(), null, false
                )
                views.setTextViewText(countdownViewId, next.time)
            }

            CountdownMode.NONE -> {
                views.setChronometer(
                    countdownViewId, SystemClock.elapsedRealtime(), null, false
                )
                views.setViewVisibility(countdownViewId, View.GONE)
                views.setTextViewText(labelViewId, next.name)
            }
        }
    }
}
