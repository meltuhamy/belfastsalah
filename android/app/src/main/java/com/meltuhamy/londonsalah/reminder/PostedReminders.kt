package com.meltuhamy.londonsalah.reminder

import android.content.Context

/**
 * The last few reminders posted, so none is posted twice.
 *
 * A reminder is armed whenever it is still ahead of the clock a replan runs
 * against. One posted a moment before its time - within
 * [ReminderAlarms.EARLY_TOLERANCE_MILLIS] - is still ahead, so a replan then
 * (the app opening, a setting changing) arms it again and it would fire a
 * second time. A handful is plenty: only the reminders of the last few
 * seconds can come round again.
 */
object PostedReminders {
    private const val PREFS = "reminder_posted"
    private const val KEY = "recent"
    private const val KEEP = 12

    /** Records [entry] as posted. False if it already was. */
    @Synchronized
    fun markPosted(context: Context, entry: ReminderEntry): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val id = "${entry.at}|${entry.title}"
        val recent = prefs.getString(KEY, null)
            ?.split("\n")
            ?.filter { it.isNotEmpty() }
            ?: emptyList()
        if (id in recent) return false
        val kept = (recent + id).takeLast(KEEP)
        prefs.edit().putString(KEY, kept.joinToString("\n")).commit()
        return true
    }
}
