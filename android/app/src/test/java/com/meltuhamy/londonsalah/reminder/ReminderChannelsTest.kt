package com.meltuhamy.londonsalah.reminder

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * One channel per prayer: made from the channel the prayer used before, so an
 * upgrade changes nothing, and replaced - with the user's settings carried
 * over - when its sound changes.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class ReminderChannelsTest {

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val notifications = context.getSystemService(NotificationManager::class.java)

    private val everyDefault = ReminderChannels.PRAYERS.associateWith { ReminderSounds.DEFAULT }

    private fun channelOf(prayer: String): NotificationChannel =
        notifications.getNotificationChannel(ReminderChannels.current(context, prayer)!!.id)

    private fun legacy(id: String, importance: Int, configure: NotificationChannel.() -> Unit = {}) {
        notifications.createNotificationChannel(
            NotificationChannel(id, id, importance).apply(configure)
        )
    }

    @Test
    fun `a new install gets sound and no pop-up, named after each prayer`() {
        val ids = ReminderChannels.ensure(context, everyDefault + ("isha" to "silent"))

        assertEquals(ReminderChannels.PRAYERS.toSet(), ids.keys)
        assertEquals(6, ids.values.toSet().size)
        val fajr = channelOf("fajr")
        assertEquals("Fajr", fajr.name)
        assertEquals(NotificationManager.IMPORTANCE_DEFAULT, fajr.importance)
        val isha = channelOf("isha")
        assertEquals(NotificationManager.IMPORTANCE_LOW, isha.importance)
        assertNull(isha.sound)
    }

    @Test
    fun `an upgrade copies each prayer's channel from the one its sound used`() {
        legacy("default", NotificationManager.IMPORTANCE_HIGH) {
            enableVibration(false)
            setShowBadge(false)
        }
        legacy("adhan-2", NotificationManager.IMPORTANCE_LOW)

        ReminderChannels.ensure(context, everyDefault + ("maghrib" to "adhan-2"))

        val fajr = channelOf("fajr")
        assertEquals(NotificationManager.IMPORTANCE_HIGH, fajr.importance)
        assertFalse(fajr.shouldVibrate())
        assertFalse(fajr.canShowBadge())
        val maghrib = channelOf("maghrib")
        assertEquals(NotificationManager.IMPORTANCE_LOW, maghrib.importance)
        assertEquals(
            "android.resource://${context.packageName}/raw/adhan_2",
            maghrib.sound.toString()
        )
    }

    @Test
    fun `deletes the per-sound channels, all but default`() {
        legacy("default", NotificationManager.IMPORTANCE_DEFAULT)
        legacy("silent", NotificationManager.IMPORTANCE_LOW)
        legacy("adhan-1", NotificationManager.IMPORTANCE_DEFAULT)

        ReminderChannels.ensure(context, everyDefault)

        assertNotNull(notifications.getNotificationChannel("default"))
        assertNull(notifications.getNotificationChannel("silent"))
        assertNull(notifications.getNotificationChannel("adhan-1"))
    }

    @Test
    fun `leaves a prayer's channel alone while its sound is unchanged`() {
        val first = ReminderChannels.ensure(context, everyDefault)
        val again = ReminderChannels.ensure(context, everyDefault)
        assertEquals(first, again)
    }

    @Test
    fun `a new sound gets a new channel with the user's settings, and the old one goes`() {
        // Pop-ups on and vibration off: how this phone had reminders before.
        legacy("default", NotificationManager.IMPORTANCE_HIGH) { enableVibration(false) }
        ReminderChannels.ensure(context, everyDefault)
        val old = ReminderChannels.current(context, "fajr")!!.id
        val highNow = NotificationManager.IMPORTANCE_HIGH

        val ids = ReminderChannels.ensure(context, everyDefault + ("fajr" to "adhan-3"))

        assertNotEquals(old, ids["fajr"])
        assertNull(notifications.getNotificationChannel(old))
        val fajr = channelOf("fajr")
        assertEquals("Fajr", fajr.name)
        assertEquals(highNow, fajr.importance)
        assertFalse(fajr.shouldVibrate())
        assertEquals(
            "android.resource://${context.packageName}/raw/adhan_3",
            fajr.sound.toString()
        )
        // The other prayers are untouched.
        assertEquals(ReminderChannels.current(context, "duhr")!!.id, ids["duhr"])
    }

    @Test
    fun `a sound after silent is heard, and silent does not vibrate`() {
        ReminderChannels.ensure(context, everyDefault + ("asr" to "silent"))
        assertFalse(channelOf("asr").shouldVibrate())

        ReminderChannels.ensure(context, everyDefault + ("asr" to "adhan-1"))

        val asr = channelOf("asr")
        assertEquals(NotificationManager.IMPORTANCE_DEFAULT, asr.importance)
        assertTrue(asr.shouldVibrate())
    }

    @Test
    fun `a prayer left out keeps the sound its channel has`() {
        ReminderChannels.ensure(context, everyDefault + ("duhr" to "adhan-4"))
        val before = ReminderChannels.current(context, "duhr")

        ReminderChannels.ensure(context, emptyMap())

        assertEquals(before, ReminderChannels.current(context, "duhr"))
    }

    @Test
    fun `reads back the importance the user has`() {
        ReminderChannels.ensure(context, everyDefault)
        assertEquals(
            NotificationManager.IMPORTANCE_DEFAULT,
            ReminderChannels.importance(context, "shuruq")
        )
    }
}
