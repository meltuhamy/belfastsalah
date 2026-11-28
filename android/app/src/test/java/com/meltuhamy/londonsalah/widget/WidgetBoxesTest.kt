package com.meltuhamy.londonsalah.widget

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * Which boxes a placed widget is drawn for, from what its launcher reports
 * (WidgetBoxes). The sizes are real launchers' own, from WidgetSizeLog.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [35], qualifiers = WidgetHarness.PHONE)
class WidgetBoxesTest {

    @Test
    fun theUprightAndTurnedBoxesAreDrawnForApart() {
        // The Pixel launcher's 4 x 1 on a Pixel 9 Pro XL, Android 16.
        val boxes = WidgetBoxes.of(
            minWidth = 396, minHeight = 65, maxWidth = 706, maxHeight = 117,
            reported = listOf(396 to 116, 396 to 117, 706 to 65, 706 to 65)
        )
        // 396 x 116 and 117 are one box, drawn at the one that fits both.
        assertEquals(WidgetBoxes.Sized(listOf(706 to 65, 396 to 116)), boxes)
    }

    @Test
    fun withNoSizesReportedTheMinimaAndMaximaGiveBothOrientations() {
        // Before Android 12, or a launcher that sends no list.
        assertEquals(
            WidgetBoxes.Oriented(portrait = 396 to 250, landscape = 706 to 140),
            WidgetBoxes.of(396, 140, 706, 250, reported = null)
        )
    }

    @Test
    fun aLauncherReportingOneSizeGetsOneDrawing() {
        assertEquals(
            WidgetBoxes.Single(374 to 221),
            WidgetBoxes.of(374, 221, 374, 221, reported = listOf(374 to 221))
        )
        assertEquals(WidgetBoxes.Single(374 to 221), WidgetBoxes.of(374, 221, 374, 221, null))
        assertEquals(WidgetBoxes.Single(null), WidgetBoxes.of(0, 0, 0, 0, null))
    }

    @Test
    fun theUprightBoxStillGrowsWhereALandscapeOneIsReportedToo() {
        // The point of drawing each box apart, rather than the smallest: a
        // portrait-only home screen still reports a turned box, and Samsung's
        // 374 x 221 has to keep its growth.
        val boxes = WidgetBoxes.of(374, 105, 700, 221, null) as WidgetBoxes.Oriented
        assertTrue(WidgetGrowth.of(WidgetKind.WIDE, boxes.portrait).body > 1.2f)
        assertEquals(1f, WidgetGrowth.of(WidgetKind.WIDE, boxes.landscape).body)
    }

    @Test
    fun noMoreThanFourBoxesAreDrawnTheSmallestKept() {
        val many = (0 until 10).map { (300 + 20 * it) to (100 + 20 * it) }
        val kept = WidgetBoxes.distinct(many)
        assertEquals(WidgetBoxes.MAX_BOXES, kept.size)
        assertEquals(300 to 100, kept.first())
    }

    @Test
    fun theSkyPicturesShareOneBudget() {
        // Every box's picture crosses to the launcher in one transaction.
        val one = WidgetHarness.draw(
            WidgetKind.WIDE, 396 to 250, WidgetConfig(palette = WidgetPalette.SKY)
        ).skyPicture()!!
        assertTrue(one.width * one.height <= SkyPainter.MAX_PIXELS)
        val shared = SkyPainter.paint(
            sky = WidgetPayload.parse(PayloadFixture.forJan15())!!.skyAt(PayloadFixture.ONE_PM)!!,
            widthDp = 396, heightDp = 250, density = 3f, sunDp = 30f,
            maxPixels = SkyPainter.MAX_PIXELS / 2
        )
        assertTrue(shared.width * shared.height <= SkyPainter.MAX_PIXELS / 2 + 1000)
    }
}
