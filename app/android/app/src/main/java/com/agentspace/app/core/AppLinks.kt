package com.agentspace.app.core

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import com.agentspace.app.MainActivity

/**
 * `agentspace://` deep links opened by notifications, widgets and Google Assistant. The web app maps them to
 * in-app paths (app/src/platform/native.ts `toPath`, app/src/platform/mobile-assistant.ts for `assistant/…`).
 */
object DeepLinks {
    const val SCHEME = "agentspace://"
    /** New chat / quick-ask (optional `?bot=<name>&text=<question>`). */
    const val ASK = "${SCHEME}assistant/ask"
    /** Voice mode (optional `?bot=<name>`). */
    const val VOICE = "${SCHEME}assistant/voice"
    const val APPROVALS = "${SCHEME}approvals"

    fun approval(id: String) = "$APPROVALS/${Uri.encode(id)}"

    /** An in-app path ("/tasks/123") or an agentspace:// link → an agentspace:// link. */
    fun fromPath(path: String) = if (path.startsWith(SCHEME)) path else SCHEME + path.trimStart('/')

    /** A PendingIntent that opens the app at [url]; [requestCode] keeps PendingIntents for different urls apart. */
    fun open(context: Context, url: String, requestCode: Int = url.hashCode()): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url), context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
}

/** Notification channels owned by the native code (push/local notification plugins create their own). */
object Channels {
    const val APPROVALS = "approvals"
    const val TASK_PROGRESS = "task_progress"
    const val VOICE = "voice_mode"

    fun ensure(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(NotificationChannel(APPROVALS, "Approvals", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Actions your bots are waiting for you to approve"
        })
        nm.createNotificationChannel(NotificationChannel(TASK_PROGRESS, "Task progress", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Live progress of long tasks"
            setShowBadge(false)
        })
        nm.createNotificationChannel(NotificationChannel(VOICE, "Voice mode", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Shown while voice mode is on"
            setShowBadge(false)
        })
    }
}
