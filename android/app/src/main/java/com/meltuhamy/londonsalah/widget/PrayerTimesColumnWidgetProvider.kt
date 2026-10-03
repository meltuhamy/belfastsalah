package com.meltuhamy.londonsalah.widget

/**
 * Two cells by three: the day's six times down a single column, with the
 * countdown tucked inside the next prayer's row rather than given a heading.
 *
 * The one-row widget stood on its side - the same trade, for a home screen
 * with a narrow gap rather than a wide one.
 */
class PrayerTimesColumnWidgetProvider : RenderedWidgetProvider() {
    override val kind = WidgetKind.COLUMN
}
