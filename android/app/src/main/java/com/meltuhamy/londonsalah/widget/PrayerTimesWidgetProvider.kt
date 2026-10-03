package com.meltuhamy.londonsalah.widget

/**
 * A countdown to the next prayer, and the day's six times with the next one
 * picked out. These only choose an arrangement; the drawing is in
 * WidgetRenderer, shared with the configuration screen's preview.
 */

/** Four cells wide: the six prayers in a row under the countdown. */
class PrayerTimesWidgetProvider : RenderedWidgetProvider() {
    override val kind = WidgetKind.WIDE
}

/** Two cells wide and tall: the same information stacked. */
class PrayerTimesVerticalWidgetProvider : RenderedWidgetProvider() {
    override val kind = WidgetKind.TALL
}
