package com.meltuhamy.londonsalah.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.meltuhamy.londonsalah.MainActivity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestRule
import org.junit.runner.Description
import org.junit.runner.RunWith
import org.junit.runners.model.Statement
import java.util.regex.Pattern

/**
 * Adds the tile to the home screen the way a person does - through the
 * launcher's own "add widget" dialog - and checks it arrives drawn.
 *
 * The one thing HostedWidgetTest cannot cover, because there it is the host:
 * a real launcher taking the widget, running the configuration screen the way
 * it does when a widget is added, and putting the result on its home screen.
 *
 * It drives another app's interface, whose wording and timing are that
 * launcher's business, so it is allowed to be flaky: it retries, runs apart
 * from the other device tests, and does not fail the build. See
 * .github/workflows/android-device-tests.yml.
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class LauncherPinTest {

    @get:Rule
    val retry = Retry(times = 3)

    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context: Context = instrumentation.targetContext
    private val manager = AppWidgetManager.getInstance(context)
    private val device = UiDevice.getInstance(instrumentation)
    private val tile = ComponentName(context, NextPrayerTileProvider::class.java)

    @Before
    fun writeTimes() {
        WidgetStore.write(
            context,
            PayloadFixture.relativeTo(System.currentTimeMillis(), PayloadFixture.ASR)
        )
    }

    @Test
    fun addsTheTileThroughTheLaunchersOwnDialog() {
        assumeTrue(
            "this launcher cannot pin widgets",
            manager.isRequestPinAppWidgetSupported
        )
        val before = manager.getAppWidgetIds(tile).toSet()

        // Android only takes a pin request from an app in the foreground.
        context.startActivity(
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        assertTrue(
            "the app never came to the foreground",
            device.wait(Until.hasObject(By.pkg(context.packageName).depth(0)), 15_000)
        )

        manager.requestPinAppWidget(tile, null, null)

        val add = device.wait(Until.findObject(ADD), 10_000)
        assertNotNull("the launcher's add dialog never appeared", add)
        add.click()

        // Launchers differ on whether they open a widget's configuration
        // screen when it is pinned. If this one does, save the defaults.
        device.wait(
            Until.findObject(By.res(context.packageName, "config_save")), 5_000
        )?.click()

        waitUntil("the launcher to bind the tile") {
            (manager.getAppWidgetIds(tile).toSet() - before).isNotEmpty()
        }

        device.pressHome()
        val drawn = device.wait(
            Until.findObject(By.res(context.packageName, "tile_prayer")), 15_000
        )
        assertNotNull("the tile never appeared on the home screen", drawn)
        assertEquals("Asr in", drawn.text)
    }

    private fun waitUntil(what: String, timeoutMs: Long = 15_000, check: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + timeoutMs
        while (SystemClock.uptimeMillis() < deadline) {
            if (check()) return
            Thread.sleep(200)
        }
        fail("Timed out after ${timeoutMs}ms waiting for $what")
    }

    private companion object {
        /**
         * The confirm button in the launcher's pin dialog. Launcher3 has
         * called it both "Add automatically" and "Add to home screen", and
         * may style it in capitals, so any of those will do.
         */
        val ADD: androidx.test.uiautomator.BySelector = By.text(
            Pattern.compile("(?i)add( automatically| to home screen)?")
        )
    }
}

/**
 * Runs a test up to `times` times, passing on the first success.
 *
 * Only for tests that depend on another app's interface. Anything of our own
 * that needs retrying is a bug to fix, not to retry past.
 */
class Retry(private val times: Int) : TestRule {
    override fun apply(base: Statement, description: Description): Statement =
        object : Statement() {
            override fun evaluate() {
                var last: Throwable? = null
                repeat(times) { attempt ->
                    try {
                        base.evaluate()
                        return
                    } catch (t: Throwable) {
                        last = t
                        Log.w("Retry", "${description.displayName}: attempt ${attempt + 1} failed", t)
                    }
                }
                throw last!!
            }
        }
}
