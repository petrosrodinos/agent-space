package com.agentspace.app

import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.agentspace.app.core.Channels
import com.agentspace.app.core.DeepLinks
import com.agentspace.app.core.NativeSession
import com.agentspace.app.widgets.ApprovalsCountWorker
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

/**
 * Native helpers for the web app (app/src/platform/mobile-native.ts): the shared sign-in store, ML Kit text
 * recognition for scans, ongoing task-progress notifications and widget refreshes.
 */
@CapacitorPlugin(name = "AgentSpace")
class AgentSpacePlugin : Plugin() {
    private companion object {
        const val MAX_TEXT = 20_000
        const val PROGRESS_ID_OFFSET = 0x5000_0000
    }

    override fun load() {
        Channels.ensure(context)
    }

    // --- Sign-in store (see NativeSession) ---

    @PluginMethod
    fun getRefreshToken(call: PluginCall) {
        call.resolve(JSObject().put("token", NativeSession.refreshToken(context)))
    }

    @PluginMethod
    fun setRefreshToken(call: PluginCall) {
        NativeSession.setRefreshToken(context, call.getString("token"))
        call.resolve()
    }

    /** Mirrors the web app's session: `{ apiUrl, organizationId, accessToken, accessExpiresAt (ms) }`. */
    @PluginMethod
    fun setSession(call: PluginCall) {
        NativeSession.setSession(
            context,
            call.getString("apiUrl"),
            call.getString("organizationId"),
            call.getString("accessToken"),
            call.getLong("accessExpiresAt"),
        )
        call.resolve()
    }

    @PluginMethod
    fun clearSession(call: PluginCall) {
        NativeSession.clear(context)
        ApprovalsCountWorker.refreshNow(context)
        call.resolve()
    }

    // --- Text recognition (document scanner, §14.3) ---

    /** `{ path }` = a file:// or content:// image URI (or an absolute path) → `{ text }`. */
    @PluginMethod
    fun recognizeText(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("Missing path")
        val uri = if (path.startsWith("/")) Uri.fromFile(java.io.File(path)) else Uri.parse(path)
        val image = try {
            InputImage.fromFilePath(context, uri)
        } catch (e: Exception) {
            return call.reject("Could not read the scanned image")
        }
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        recognizer.process(image)
            .addOnSuccessListener { result -> call.resolve(JSObject().put("text", result.text.trim().take(MAX_TEXT))) }
            .addOnFailureListener { e -> call.reject(e.message ?: "Text recognition failed") }
            .addOnCompleteListener { recognizer.close() }
    }

    // --- Live progress of long tasks (§14.2) ---

    /** `{ id, title, text?, progress?, max?, url? }` — omit progress/max for an indeterminate bar. */
    @PluginMethod
    fun showProgress(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("Missing id")
        val nm = NotificationManagerCompat.from(context)
        if (!nm.areNotificationsEnabled()) return call.resolve(JSObject().put("shown", false))
        val max = call.getInt("max") ?: 0
        val progress = call.getInt("progress") ?: 0
        val url = call.getString("url")?.let(DeepLinks::fromPath)
        val builder = NotificationCompat.Builder(context, Channels.TASK_PROGRESS)
            .setSmallIcon(R.drawable.ic_stat_agentspace)
            .setContentTitle(call.getString("title") ?: "Working…")
            .setContentText(call.getString("text"))
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setProgress(max, progress.coerceIn(0, maxOf(max, 0)), max <= 0)
        url?.let { builder.setContentIntent(DeepLinks.open(context, it)) }
        try {
            nm.notify(notificationId(id), builder.build())
            call.resolve(JSObject().put("shown", true))
        } catch (e: SecurityException) {
            call.resolve(JSObject().put("shown", false))
        }
    }

    /** `{ id, title?, text? }` — with a title, leaves a dismissible "done" notification; without, removes it. */
    @PluginMethod
    fun endProgress(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("Missing id")
        val nm = NotificationManagerCompat.from(context)
        val title = call.getString("title")
        if (title == null || !nm.areNotificationsEnabled()) {
            nm.cancel(notificationId(id))
            return call.resolve()
        }
        val url = call.getString("url")?.let(DeepLinks::fromPath)
        val builder = NotificationCompat.Builder(context, Channels.TASK_PROGRESS)
            .setSmallIcon(R.drawable.ic_stat_agentspace)
            .setContentTitle(title)
            .setContentText(call.getString("text"))
            .setOngoing(false)
            .setAutoCancel(true)
        url?.let { builder.setContentIntent(DeepLinks.open(context, it)) }
        try {
            nm.notify(notificationId(id), builder.build())
        } catch (e: SecurityException) {
            // ignore
        }
        call.resolve()
    }

    // --- Widgets ---

    @PluginMethod
    fun refreshWidgets(call: PluginCall) {
        ApprovalsCountWorker.refreshNow(context)
        call.resolve()
    }

    private fun notificationId(id: String) = PROGRESS_ID_OFFSET xor id.hashCode()
}
