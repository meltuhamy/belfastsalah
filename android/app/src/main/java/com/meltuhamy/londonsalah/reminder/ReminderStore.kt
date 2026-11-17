package com.meltuhamy.londonsalah.reminder

import android.content.Context
import java.io.File
import java.io.IOException
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream

/**
 * Where the app leaves the reminder list for the alarms to read.
 *
 * A file rather than SharedPreferences, and gzipped. The JSON is about 800KB
 * once every title is stored in full - more than the 200KB a list of instants
 * would be - and preferences are parsed into memory for every read of any key.
 * Gzip brings the file back under 200KB. The widget payload is small enough
 * that neither concern applies to it.
 *
 * The write is replaced as a whole, so a reader never sees a half-written
 * list and rearms from it.
 */
object ReminderStore {
    private const val FILE_NAME = "reminders.json"

    fun write(context: Context, payload: String) {
        val dest = file(context)
        val tmp = File(dest.parentFile, "$FILE_NAME.tmp")
        GZIPOutputStream(tmp.outputStream()).use { gzip ->
            gzip.write(payload.toByteArray(Charsets.UTF_8))
        }
        if (!tmp.renameTo(dest)) {
            GZIPOutputStream(dest.outputStream()).use { gzip ->
                gzip.write(payload.toByteArray(Charsets.UTF_8))
            }
            tmp.delete()
        }
    }

    fun read(context: Context): String? {
        val stored = file(context)
        if (!stored.exists() || stored.length() == 0L) return null
        return try {
            GZIPInputStream(stored.inputStream()).use { gzip ->
                gzip.readBytes().toString(Charsets.UTF_8)
            }
        } catch (_: IOException) {
            null
        }
    }

    fun clear(context: Context) {
        file(context).delete()
        File(context.filesDir, "$FILE_NAME.tmp").delete()
    }

    private fun file(context: Context) = File(context.filesDir, FILE_NAME)
}
