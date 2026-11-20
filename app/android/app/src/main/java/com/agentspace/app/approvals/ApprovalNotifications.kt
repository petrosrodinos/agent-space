package com.agentspace.app.approvals

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.agentspace.app.R
import com.agentspace.app.core.Channels
import com.agentspace.app.core.DeepLinks

/**
 * The FCM data message the API sends for an approval (§14.2 "approving from the lock screen"). It must be a
 * data-only message (no `notification` block), or Android shows it by itself and the actions are lost:
 *
 * ```
 * { "message": { "token": "<fcm token>", "android": { "priority": "HIGH" }, "data": {
 *     "kind": "approval", "approval_id": "<uuid>", "organization_id": "<uuid>",
 *     "title": "Sales Sam wants to send an email", "body": "To anna@acme.com: Contract ready",
 *     "requires_biometric": "false", "url": "/approvals/<uuid>" } } }
 * ```
 * All values are strings (FCM data). `requires_biometric: "true"` → no action buttons; tapping opens the app, which
 * asks for fingerprint / face before approving.
 */
data class ApprovalPush(
    val approvalId: String,
    val organizationId: String?,
    val title: String,
    val body: String,
    val requiresBiometric: Boolean,
) {
    companion object {
        const val KIND = "kind"
        const val KIND_APPROVAL = "approval"
        private const val APPROVAL_ID = "approval_id"
        private const val ORGANIZATION_ID = "organization_id"
        private const val TITLE = "title"
        private const val BODY = "body"
        private const val REQUIRES_BIOMETRIC = "requires_biometric"

        fun from(data: Map<String, String>): ApprovalPush? {
            if (data[KIND] != KIND_APPROVAL) return null
            val id = data[APPROVAL_ID]?.takeIf { it.isNotBlank() } ?: return null
            return ApprovalPush(
                approvalId = id,
                organizationId = data[ORGANIZATION_ID]?.takeIf { it.isNotBlank() },
                title = data[TITLE]?.takeIf { it.isNotBlank() } ?: "Approval needed",
                body = data[BODY] ?: "",
                requiresBiometric = data[REQUIRES_BIOMETRIC] == "true",
            )
        }
    }
}

object ApprovalNotifications {
    private const val RESULT_TIMEOUT_MS = 6_000L

    fun notificationId(approvalId: String) = approvalId.hashCode()

    fun show(context: Context, push: ApprovalPush) {
        Channels.ensure(context)
        val nm = NotificationManagerCompat.from(context)
        if (!nm.areNotificationsEnabled()) return
        val open = DeepLinks.open(context, DeepLinks.approval(push.approvalId))
        val body = if (push.requiresBiometric) listOf(push.body, "Open Agent Space to approve with your fingerprint or face.").filter { it.isNotBlank() }.joinToString("\n") else push.body

        fun base() = NotificationCompat.Builder(context, Channels.APPROVALS)
            .setSmallIcon(R.drawable.ic_stat_agentspace)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(open)
            .setAutoCancel(true)

        val builder = base()
            .setContentTitle(push.title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
        // Lock screen with "hide sensitive content": no details, but the same buttons.
        val publicVersion = base().setContentTitle("Approval needed").setContentText("Unlock to see the details")

        if (!push.requiresBiometric) {
            for ((decision, label) in listOf(ApprovalActionReceiver.DECISION_APPROVE to "Approve", ApprovalActionReceiver.DECISION_REJECT to "Reject")) {
                val action = NotificationCompat.Action.Builder(0, label, actionIntent(context, push, decision))
                    // Android 12+: the phone must be unlocked before the action runs (§14.2).
                    .setAuthenticationRequired(true)
                    .build()
                builder.addAction(action)
                publicVersion.addAction(action)
            }
        }
        builder.setPublicVersion(publicVersion.build())
        try {
            nm.notify(notificationId(push.approvalId), builder.build())
        } catch (e: SecurityException) {
            // POST_NOTIFICATIONS was revoked between the check and the call.
        }
    }

    /** Replaces the approval notification with the outcome, which then clears itself. */
    fun showResult(context: Context, approvalId: String, title: String, text: String?) {
        val nm = NotificationManagerCompat.from(context)
        if (!nm.areNotificationsEnabled()) return
        val n = NotificationCompat.Builder(context, Channels.APPROVALS)
            .setSmallIcon(R.drawable.ic_stat_agentspace)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(DeepLinks.open(context, DeepLinks.approval(approvalId)))
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setAutoCancel(true)
            .setTimeoutAfter(RESULT_TIMEOUT_MS)
            .build()
        try {
            nm.notify(notificationId(approvalId), n)
        } catch (e: SecurityException) {
            // ignore
        }
    }

    private fun actionIntent(context: Context, push: ApprovalPush, decision: String): PendingIntent {
        val intent = Intent(context, ApprovalActionReceiver::class.java)
            .setAction(ApprovalActionReceiver.ACTION_RESOLVE)
            .putExtra(ApprovalActionReceiver.EXTRA_APPROVAL_ID, push.approvalId)
            .putExtra(ApprovalActionReceiver.EXTRA_ORGANIZATION_ID, push.organizationId)
            .putExtra(ApprovalActionReceiver.EXTRA_DECISION, decision)
        val requestCode = (push.approvalId + decision).hashCode()
        return PendingIntent.getBroadcast(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
}
