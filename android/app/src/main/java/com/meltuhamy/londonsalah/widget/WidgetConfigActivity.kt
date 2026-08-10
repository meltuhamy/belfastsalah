package com.meltuhamy.londonsalah.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.RadioGroup
import android.widget.SeekBar
import com.meltuhamy.londonsalah.R

/**
 * Shown when a widget is added, and again from the launcher's own "reconfigure"
 * on Android 12 and later. Settings are per appWidgetId, so two copies of the
 * same widget can look different.
 *
 * The result is set to CANCELED first and only changed on Save: backing out of
 * this screen has to leave no widget behind, which is what the AppWidget host
 * expects.
 */
class WidgetConfigActivity : Activity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)
        setContentView(R.layout.activity_widget_config)

        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        val existing = WidgetConfig.load(this, appWidgetId)
        val palette = findViewById<RadioGroup>(R.id.config_palette)
        val text = findViewById<RadioGroup>(R.id.config_text)
        val accent = findViewById<RadioGroup>(R.id.config_accent)
        val countdown = findViewById<RadioGroup>(R.id.config_countdown)
        val opacity = findViewById<SeekBar>(R.id.config_opacity)

        palette.check(
            when (existing.palette) {
                WidgetPalette.SYSTEM -> R.id.palette_system
                WidgetPalette.LIGHT -> R.id.palette_light
                WidgetPalette.DARK -> R.id.palette_dark
            }
        )
        text.check(
            when (existing.textTone) {
                WidgetTextTone.AUTO -> R.id.text_auto
                WidgetTextTone.LIGHT -> R.id.text_light
                WidgetTextTone.DARK -> R.id.text_dark
            }
        )
        accent.check(
            when (existing.accent) {
                0 -> R.id.accent_blue
                1 -> R.id.accent_green
                2 -> R.id.accent_amber
                3 -> R.id.accent_violet
                else -> R.id.accent_none
            }
        )
        countdown.check(
            when (existing.countdown) {
                CountdownMode.SECONDS -> R.id.countdown_seconds
                CountdownMode.TIME -> R.id.countdown_time
                CountdownMode.NONE -> R.id.countdown_none
            }
        )
        opacity.progress = existing.opacity

        findViewById<Button>(R.id.config_save).setOnClickListener {
            WidgetConfig.save(
                this,
                appWidgetId,
                WidgetConfig(
                    palette = when (palette.checkedRadioButtonId) {
                        R.id.palette_light -> WidgetPalette.LIGHT
                        R.id.palette_dark -> WidgetPalette.DARK
                        else -> WidgetPalette.SYSTEM
                    },
                    opacity = opacity.progress,
                    textTone = when (text.checkedRadioButtonId) {
                        R.id.text_light -> WidgetTextTone.LIGHT
                        R.id.text_dark -> WidgetTextTone.DARK
                        else -> WidgetTextTone.AUTO
                    },
                    accent = when (accent.checkedRadioButtonId) {
                        R.id.accent_green -> 1
                        R.id.accent_amber -> 2
                        R.id.accent_violet -> 3
                        R.id.accent_none -> WidgetConfig.NO_ACCENT
                        else -> 0
                    },
                    countdown = when (countdown.checkedRadioButtonId) {
                        R.id.countdown_time -> CountdownMode.TIME
                        R.id.countdown_none -> CountdownMode.NONE
                        else -> CountdownMode.SECONDS
                    }
                )
            )

            WidgetUpdater.refreshAll(applicationContext)
            WidgetAlarms.scheduleNextBoundary(applicationContext)

            setResult(
                RESULT_OK,
                Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            )
            finish()
        }
    }
}
