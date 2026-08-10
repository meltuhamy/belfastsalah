package com.meltuhamy.londonsalah.widget

/**
 * Four cells by one: the day's six times on a single row, with the countdown
 * tucked inside the next prayer's box rather than given a line of its own.
 *
 * The same information as the four-by-two widget, for a home screen with one
 * row to spare.
 */
class PrayerTimesCompactWidgetProvider : RenderedWidgetProvider() {
    override val kind = WidgetKind.COMPACT
}
