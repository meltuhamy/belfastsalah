package com.meltuhamy.londonsalah.reminder

import org.json.JSONException
import org.json.JSONObject

/**
 * One reminder, as TypeScript wrote it.
 *
 * `at` is the instant to fire, in epoch milliseconds. `title` and `body` are
 * already the strings to show: the title carries the prayer clock in the
 * user's display zone, and nothing here formats a time. `sound` names the
 * channel it is posted on.
 */
data class ReminderEntry(
    val at: Long,
    val title: String,
    val body: String,
    /** One of [ReminderSounds.all]. Absent in the JSON for the default sound. */
    val sound: String = ReminderSounds.DEFAULT
)

data class ReminderPayload(
    val generatedAt: Long,
    val reminders: List<ReminderEntry>
) {
    /** Reminders that should be armed at [nowMillis], earliest first. */
    fun dueWithin(nowMillis: Long, windowMs: Long): List<ReminderEntry> =
        reminders.filter { it.at > nowMillis && it.at <= nowMillis + windowMs }

    companion object {
        /** Must match REMINDER_PAYLOAD_VERSION in src/lib/reminderPayload.ts. */
        const val SUPPORTED_VERSION = 1

        /**
         * Returns null for anything unusable - absent, malformed, or written
         * by a version that does not match. Arming nothing is right here:
         * a wrong prayer reminder is worse than a quiet phone.
         */
        fun parse(json: String?): ReminderPayload? {
            if (json.isNullOrBlank()) return null
            return try {
                val root = JSONObject(json)
                if (root.optInt("version", -1) != SUPPORTED_VERSION) return null
                val remindersJson = root.getJSONArray("reminders")
                val reminders = (0 until remindersJson.length()).map { i ->
                    val entry = remindersJson.getJSONObject(i)
                    ReminderEntry(
                        entry.getLong("at"),
                        entry.getString("title"),
                        entry.getString("body"),
                        ReminderSounds.normalise(entry.optString("sound", ReminderSounds.DEFAULT))
                    )
                }
                ReminderPayload(root.getLong("generatedAt"), reminders)
            } catch (e: JSONException) {
                null
            }
        }
    }
}
