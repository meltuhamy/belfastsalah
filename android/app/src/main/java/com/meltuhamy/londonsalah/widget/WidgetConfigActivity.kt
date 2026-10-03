package com.meltuhamy.londonsalah.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
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

        /** Roughly one home screen cell. Only the ratio between them matters. */
        private const val CELL_WIDTH_DP = 76f
        private const val CELL_HEIGHT_DP = 92f

        /** How much of the screen a preview may take before it is scaled down. */
        private const val MAX_PREVIEW_HEIGHT_DP = 240f
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

        // Posted rather than called: the preview has no width until it has
        // been laid out, and its width is the scale everything is drawn to.
        preview.post { refreshPreview() }

        findViewById<Button>(R.id.config_save).setOnClickListener { save() }
    }

    /**
     * Renders the widget as it would appear, through the same code the
     * providers use. RemoteViews.apply inflates it into a real View, so this
     * cannot drift from what actually lands on the home screen.
     */
    private fun refreshPreview() {
        // Nothing to scale to yet. Only reachable if something asks for a
        // preview before the first layout; the posted call below will follow.
        if (preview.width == 0) {
            return
        }

        val (widthPx, heightPx) = previewSizePx()
        val sizeDp = (minOf(widthPx, heightPx) / resources.displayMetrics.density).toInt()

        val views = WidgetRenderer.render(this, kind, read(), sizeDp)
        preview.removeAllViews()
        preview.addView(
            views.apply(this, preview),
            FrameLayout.LayoutParams(widthPx, heightPx, Gravity.CENTER)
        )
    }

    /**
     * How big to draw the preview, in the proportions the widget will actually
     * have on a home screen.
     *
     * Left to itself the inflated layout is match_parent in both directions and
     * fills the backdrop, so every widget previewed as the same wide bar - a
     * one-cell tile included, which is the shape it is least like. Four cells
     * across is the widest widget there is, so that is what the backdrop's
     * width has to hold, and every other widget is drawn to the same scale.
     *
     * The tall ones are then scaled down to fit a sensible slice of the screen.
     * That keeps the shape honest, which is the whole point, at the cost of
     * showing a 2x4 smaller than life.
     */
    private fun previewSizePx(): Pair<Int, Int> {
        val (columns, rows) = when (kind) {
            WidgetKind.TILE -> 1 to 1
            WidgetKind.COMPACT -> 4 to 1
            WidgetKind.COLUMN -> 1 to 4
            WidgetKind.WIDE -> 4 to 2
            WidgetKind.TALL -> 2 to 4
        }

        val available = preview.width - preview.paddingLeft - preview.paddingRight
        val cellWidth = available / 4f
        // Home screen cells are a little taller than they are wide.
        val cellHeight = cellWidth * (CELL_HEIGHT_DP / CELL_WIDTH_DP)

        val width = columns * cellWidth
        val height = rows * cellHeight
        val maxHeight = MAX_PREVIEW_HEIGHT_DP * resources.displayMetrics.density
        val scale = minOf(1f, maxHeight / height)

        return (width * scale).toInt() to (height * scale).toInt()
    }

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
