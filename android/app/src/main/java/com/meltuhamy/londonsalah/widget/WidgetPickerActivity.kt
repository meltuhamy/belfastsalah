package com.meltuhamy.londonsalah.widget

import android.app.Activity
import android.app.AlertDialog
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import com.meltuhamy.londonsalah.R

/**
 * Reaches a placed widget's settings from inside the app.
 *
 * Android only offers the configuration screen when a widget is added, and
 * whether it can be reopened afterwards is up to the launcher - the Pixel
 * launcher does not offer it. Without this, changing a widget's appearance
 * would mean removing and re-adding it.
 */
class WidgetPickerActivity : Activity() {

    private data class Placed(val id: Int, val label: String)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val placed = findPlaced()
        when {
            placed.isEmpty() -> {
                Toast.makeText(this, R.string.config_widgets_none, Toast.LENGTH_LONG).show()
                finish()
            }
            // No point asking which one when there is only one.
            placed.size == 1 -> {
                configure(placed.first().id)
                finish()
            }
            else -> chooseFrom(placed)
        }
    }

    private fun findPlaced(): List<Placed> {
        val manager = AppWidgetManager.getInstance(this)
        val providers = listOf(
            NextPrayerTileProvider::class.java to R.string.widget_tile_name,
            PrayerTimesWidgetProvider::class.java to R.string.widget_times_name,
            PrayerTimesVerticalWidgetProvider::class.java to R.string.widget_vertical_name
        )

        val placed = mutableListOf<Placed>()
        for ((provider, nameRes) in providers) {
            val ids = manager.getAppWidgetIds(ComponentName(this, provider))
            ids.forEachIndexed { index, id ->
                // Two of the same kind are indistinguishable to the user
                // otherwise, so number them once there is more than one.
                val label =
                    if (ids.size > 1) "${getString(nameRes)} ${index + 1}"
                    else getString(nameRes)
                placed += Placed(id, label)
            }
        }
        return placed
    }

    private fun chooseFrom(placed: List<Placed>) {
        AlertDialog.Builder(this)
            .setTitle(R.string.config_pick_widget)
            .setItems(placed.map { it.label }.toTypedArray()) { _, which ->
                configure(placed[which].id)
                finish()
            }
            .setOnCancelListener { finish() }
            .show()
    }

    private fun configure(appWidgetId: Int) {
        startActivity(
            Intent(this, WidgetConfigActivity::class.java)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                .putExtra(WidgetConfigActivity.EXTRA_FROM_APP, true)
        )
    }
}
