package com.meltuhamy.londonsalah.preview

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.SystemClock
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.meltuhamy.londonsalah.MainActivity
import com.meltuhamy.londonsalah.widget.NextPrayerTileProvider
import com.meltuhamy.londonsalah.widget.PrayerTimesColumnWidgetProvider
import com.meltuhamy.londonsalah.widget.PrayerTimesCompactWidgetProvider
import com.meltuhamy.londonsalah.widget.PrayerTimesVerticalWidgetProvider
import com.meltuhamy.londonsalah.widget.PrayerTimesWidgetProvider
import com.meltuhamy.londonsalah.widget.WidgetConfigActivity
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Assume.assumeTrue
import org.junit.FixMethodOrder
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern

/**
 * Screenshots of the real app and its widgets on an emulator, for the preview
 * comment on pull requests. Not a test: nothing here asserts anything about
 * the app, and a screen that cannot be reached is simply missing from the
 * comment.
 *
 * It carries no size annotation, so the size-filtered runs in
 * android-device-tests.yml never pick it up. .github/workflows/previews.yml
 * runs it by class name, with `am instrument` rather than Gradle - Gradle
 * uninstalls the app afterwards, and the images live in its private files
 * directory until the workflow copies them out with `run-as`, which a debug
 * build allows. Shared storage would need permissions that vary by API level.
 *
 * Settings are written straight into the SharedPreferences file that
 * @capacitor/preferences reads, then the activity is relaunched: the
 * instrumentation shares the app's process, so the next WebView reads them
 * fresh. Tapping through setup in a WebView would be the flaky way round.
 *
 * Methods run in name order.
 */
@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class PreviewCapture {

    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context: Context = instrumentation.targetContext
    private val device = UiDevice.getInstance(instrumentation)
    private val manager = AppWidgetManager.getInstance(context)
    private val outputDir = File(context.filesDir, "previews").apply { mkdirs() }

    @Test
    fun test1Setup() {
        writeSettings(null)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            waitForJs(scenario, "!!document.querySelector('[data-testid=location-select]')")
            settle()
            capture("app-setup")
        }
    }

    @Test
    fun test2Light() = captureMainScreens("light")

    @Test
    fun test3Dark() = captureMainScreens("dark")

    private fun captureMainScreens(theme: String) {
        writeSettings(settingsJson(theme))
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            waitForJs(scenario, "!!document.querySelector('[data-testid=prayer-strip]')")
            settle()
            capture("app-today-$theme")

            // Light only: the month table looks the same in both.
            if (theme == "light") {
                runJs(
                    scenario,
                    "document.querySelector('.HomePage__month-card')" +
                        ".scrollIntoView({block: 'start'})"
                )
                settle()
                capture("app-month-$theme")
            }

            runJs(scenario, "document.querySelector(\"ion-button[aria-label='Settings']\").click()")
            waitForJs(scenario, "location.pathname === '/settings'")
            settle()
            capture("app-settings-$theme")
        }
    }

    /**
     * Each widget, put on the home screen by the launcher's own pin dialog,
     * cropped out of a screenshot of it. The app has already written the
     * widget payload by now - test2 left it with London settings - so these
     * show real times.
     */
    @Test
    fun test4Widgets() {
        assumeTrue("this launcher cannot pin widgets", manager.isRequestPinAppWidgetSupported)

        // The app writes the payload on launch; make sure it has run with
        // settings in place before any widget asks for it.
        writeSettings(settingsJson("light"))
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            waitForJs(scenario, "!!document.querySelector('[data-testid=prayer-strip]')")
            settle()
        }

        for (widget in WIDGETS) {
            try {
                pin(widget)
            } catch (t: Throwable) {
                // One widget failing to pin should not cost the others.
                android.util.Log.w("PreviewCapture", "Could not capture ${widget.name}", t)
            }
        }

        // The whole home screen, a page at a time, as far as our widgets go.
        device.pressHome()
        settle()
        var page = 1
        while (page <= 3) {
            if (ROOTS.none { device.hasObject(By.res(context.packageName, it)) }) break
            capture("home-screen-$page")
            page++
            device.swipe(
                device.displayWidth * 9 / 10, device.displayHeight / 2,
                device.displayWidth / 10, device.displayHeight / 2, 20
            )
            settle()
        }
        device.pressHome()
    }

    /** The appearance screen, for the wide widget if one was placed. */
    @Test
    fun test5WidgetSettings() {
        val ids = manager.getAppWidgetIds(ComponentName(context, PrayerTimesWidgetProvider::class.java))
        assumeTrue("no wide widget was placed", ids.isNotEmpty())
        context.startActivity(
            Intent(context, WidgetConfigActivity::class.java)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, ids.last())
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        )
        assertTrue(
            "the appearance screen never opened",
            device.wait(Until.hasObject(By.res(context.packageName, "config_save")), 10_000)
        )
        settle()
        capture("widget-settings")
        device.pressBack()
    }

    private fun pin(widget: Widget) {
        val provider = ComponentName(context, widget.provider)
        val before = manager.getAppWidgetIds(provider).toSet()

        // Bounds of every widget of ours already on the home screen, so the
        // new one can be told apart from the wide and tall widgets, which
        // share a root id.
        device.pressHome()
        settle()
        val existing = ourRoots().map { it.second }.toSet()

        // Android only takes a pin request from an app in the foreground.
        context.startActivity(
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        device.wait(Until.hasObject(By.pkg(context.packageName).depth(0)), 15_000)
        manager.requestPinAppWidget(provider, null, null)

        val add = device.wait(Until.findObject(ADD), 10_000)
            ?: throw AssertionError("the launcher's add dialog never appeared for ${widget.name}")
        add.click()

        // Some launchers open the appearance screen on pin; keep the defaults.
        device.wait(Until.findObject(By.res(context.packageName, "config_save")), 5_000)?.click()

        waitUntil("the launcher to bind ${widget.name}") {
            (manager.getAppWidgetIds(provider).toSet() - before).isNotEmpty()
        }

        // The launcher may have put it on a later page.
        device.pressHome()
        settle()
        repeat(3) {
            val found = ourRoots()
                .firstOrNull { (id, bounds) -> id == widget.root && bounds !in existing }
            if (found != null) {
                capture(widget.name, found.second)
                device.pressHome()
                return
            }
            device.swipe(
                device.displayWidth * 9 / 10, device.displayHeight / 2,
                device.displayWidth / 10, device.displayHeight / 2, 20
            )
            settle()
        }
        device.pressHome()
        fail("${widget.name} was bound but never found on the home screen")
    }

    private fun ourRoots(): List<Pair<String, Rect>> =
        ROOTS.flatMap { id ->
            device.findObjects(By.res(context.packageName, id)).map { id to it.visibleBounds }
        }

    private fun settingsJson(theme: String) =
        """{"notify":false,"notifyMinutes":5,"asrMethod":"shafi","theme":"$theme",""" +
            """"location":"london","showTimesInDeviceZone":false,"timeZoneNoticeSeen":true}"""

    private fun writeSettings(json: String?) {
        val editor = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit()
        if (json == null) editor.remove("settings") else editor.putString("settings", json)
        editor.commit()
    }

    private fun runJs(scenario: ActivityScenario<MainActivity>, js: String): String? {
        val latch = CountDownLatch(1)
        var result: String? = null
        scenario.onActivity { activity ->
            activity.bridge.webView.evaluateJavascript(js) {
                result = it
                latch.countDown()
            }
        }
        latch.await(5, TimeUnit.SECONDS)
        return result
    }

    private fun waitForJs(scenario: ActivityScenario<MainActivity>, condition: String) {
        waitUntil(condition, timeoutMs = 30_000) {
            runJs(scenario, "(function(){try{return $condition}catch(e){return false}})()") == "true"
        }
    }

    /** Lets the splash screen, page transitions and scrolling come to rest. */
    private fun settle() {
        device.waitForIdle()
        Thread.sleep(1_500)
    }

    private fun capture(name: String, crop: Rect? = null) {
        val screen = instrumentation.uiAutomation.takeScreenshot()
            ?: throw AssertionError("no screenshot for $name")
        val image = if (crop == null) screen else {
            // A little of the wallpaper around it, so its corners show.
            val margin = (8 * context.resources.displayMetrics.density).toInt()
            val r = Rect(crop).apply {
                inset(-margin, -margin)
                intersect(0, 0, screen.width, screen.height)
            }
            Bitmap.createBitmap(screen, r.left, r.top, r.width(), r.height())
        }
        File(outputDir, "$name.png").outputStream().use {
            image.compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }

    private fun waitUntil(what: String, timeoutMs: Long = 15_000, check: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + timeoutMs
        while (SystemClock.uptimeMillis() < deadline) {
            if (check()) return
            Thread.sleep(250)
        }
        fail("Timed out after ${timeoutMs}ms waiting for $what")
    }

    private data class Widget(val name: String, val provider: Class<*>, val root: String)

    private companion object {
        /** Roots of the five layouts; the wide and tall widgets share one. */
        val ROOTS = listOf("tile_root", "compact_root", "column_root", "widget_root")

        val WIDGETS = listOf(
            Widget("widget-tile", NextPrayerTileProvider::class.java, "tile_root"),
            Widget("widget-compact", PrayerTimesCompactWidgetProvider::class.java, "compact_root"),
            Widget("widget-column", PrayerTimesColumnWidgetProvider::class.java, "column_root"),
            Widget("widget-wide", PrayerTimesWidgetProvider::class.java, "widget_root"),
            Widget("widget-tall", PrayerTimesVerticalWidgetProvider::class.java, "widget_root")
        )

        /** Same wording as LauncherPinTest's: Launcher3 has used all three. */
        val ADD: androidx.test.uiautomator.BySelector = By.text(
            Pattern.compile("(?i)add( automatically| to home screen)?")
        )
    }
}
