package com.meltuhamy.londonsalah.widget

/**
 * One row, four cells wide: the next prayer's name, with the countdown small
 * above it. The other next-prayer widget is the square tile; this is the same
 * information for people who would rather give it a strip than a block.
 */
class NextPrayerBannerProvider : RenderedWidgetProvider() {
    override val kind = WidgetKind.BANNER
}
