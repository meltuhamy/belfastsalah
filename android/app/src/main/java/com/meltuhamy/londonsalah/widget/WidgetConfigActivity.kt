package com.meltuhamy.londonsalah.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.FrameLayout
import android.widget.RadioGroup
import android.widget.SeekBar
import com.meltuhamy.londonsalah.R

/**
 * Shown when a widget is added, and reachable afterwards from the app's
 * settings. Choices are per appWidgetId, so two copies of the same widget can
 * look different.
 *
 * The result is CANCELED until Save: backing out of this screen when a widget
 * is being added has to leave no widget behind, which is what the host expects.
 * Reached from the app instead, there is no host waiting and the result is
 * simply ignored.
 */
class WidgetConfigActivity : Activity() {

    companion object {
        /** Set when opened from the app rather than by the widget host. */
        const val EXTRA_FROM_APP = "from_app"
    }

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private lateinit var kind: WidgetKind
    private lateinit var preview: FrameLayout
    private lateinit var palette: RadioGroup
    private lateinit var text: RadioGroup
    private lateinit var accent: RadioGroup
    private lateinit var countdown: RadioGroup
    private lateinit var opacity: SeekBar
    private lateinit var showSection: View
    private lateinit var showLocation: CheckBox
    private lateinit var showDate: CheckBox

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

        kind = WidgetKind.forProvider(
            AppWidgetManager.getInstance(this)
                .getAppWidgetInfo(appWidgetId)?.provider?.className ?: ""
        )

        preview = findViewById(R.id.config_preview)
        palette = findViewById(R.id.config_palette)
        text = findViewById(R.id.config_text)
        accent = findViewById(R.id.config_accent)
        countdown = findViewById(R.id.config_countdown)
        opacity = findViewById(R.id.config_opacity)
        showSection = findViewById(R.id.config_show_section)
        showLocation = findViewById(R.id.show_location)
        showDate = findViewById(R.id.show_date)

        // Only offer what this widget actually draws. The one-row and
        // one-column layouts have room for neither line; the tile has no date.
        showSection.visibility =
            if (kind == WidgetKind.COMPACT || kind == WidgetKind.COLUMN) View.GONE
            else View.VISIBLE
        showDate.visibility = if (kind == WidgetKind.TILE) View.GONE else View.VISIBLE

        show(WidgetConfig.load(this, appWidgetId))

        val onChange = RadioGroup.OnCheckedChangeListener { _, _ -> refreshPreview() }
        palette.setOnCheckedChangeListener(onChange)
        text.setOnCheckedChangeListener(onChange)
        accent.setOnCheckedChangeListener(onChange)
        countdown.setOnCheckedChangeListener(onChange)
        showLocation.setOnCheckedChangeListener { _, _ -> refreshPreview() }
        showDate.setOnCheckedChangeListener { _, _ -> refreshPreview() }
        opacity.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(bar: SeekBar, value: Int, fromUser: Boolean) =
                refreshPreview()

            override fun onStartTrackingTouch(bar: SeekBar) = Unit
            override fun onStopTrackingTouch(bar: SeekBar) = Unit
        })

        refreshPreview()

        findViewById<Button>(R.id.config_save).setOnClickListener { save() }
    }

    /**
     * Renders the widget as it would appear, through the same code the
     * providers use. RemoteViews.apply inflates it into a real View, so this
     * cannot drift from what actually lands on the home screen.
     */
    private fun refreshPreview() {
        val views = WidgetRenderer.render(this, kind, read(), previewSizeDp())
        preview.removeAllViews()
        preview.addView(views.apply(this, preview))
    }

    /** The tile scales its text to its size; preview it as a placed 2x2. */
    private fun previewSizeDp(): Int? = if (kind == WidgetKind.TILE) 140 else null

    private fun show(config: WidgetConfig) {
        palette.check(
            when (config.palette) {
                WidgetPalette.SYSTEM -> R.id.palette_system
                WidgetPalette.LIGHT -> R.id.palette_light
                WidgetPalette.DARK -> R.id.palette_dark
            }
        )
        text.check(
            when (config.textTone) {
                WidgetTextTone.AUTO -> R.id.text_auto
                WidgetTextTone.LIGHT -> R.id.text_light
                WidgetTextTone.DARK -> R.id.text_dark
            }
        )
        accent.check(
            when (config.accent) {
                0 -> R.id.accent_blue
                1 -> R.id.accent_green
                2 -> R.id.accent_amber
                3 -> R.id.accent_violet
                else -> R.id.accent_none
            }
        )
        countdown.check(
            when (config.countdown) {
                CountdownMode.SECONDS -> R.id.countdown_seconds
                CountdownMode.TIME -> R.id.countdown_time
                CountdownMode.NONE -> R.id.countdown_none
            }
        )
        opacity.progress = config.opacity
        showLocation.isChecked = config.showLocation
        showDate.isChecked = config.showDate
    }

    private fun read() = WidgetConfig(
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
        },
        showLocation = showLocation.isChecked,
        showDate = showDate.isChecked
    )

    private fun save() {
        WidgetConfig.save(this, appWidgetId, read())
        WidgetUpdater.refreshAll(applicationContext)
        WidgetAlarms.scheduleNextBoundary(applicationContext)

        setResult(
            RESULT_OK,
            Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        )
        finish()
    }
}
