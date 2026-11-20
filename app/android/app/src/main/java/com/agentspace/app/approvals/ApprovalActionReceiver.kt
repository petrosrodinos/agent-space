package com.agentspace.app.approvals

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.agentspace.app.core.DeepLinks
import com.agentspace.app.core.NativeSession
import com.agentspace.app.widgets.ApprovalsCountWorker
import org.json.JSONObject

/**
 * Approve / Reject from the notification (§14.2). Calls `POST /approvals/:id/resolve` with the stored sign-in
 * (api/src/modules/approvals/approvals.controller.ts). The phone must be unlocked: Android 12+ enforces it with
 * `setAuthenticationRequired`; on older versions a locked phone opens the approval in the app instead.
 */
class ApprovalActionReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_RESOLVE = "com.agentspace.app.approvals.RESOLVE"
        const val EXTRA_APPROVAL_ID = "approval_id"
        const val EXTRA_ORGANIZATION_ID = "organization_id"
        const val EXTRA_DECISION = "decision"
        const val DECISION_APPROVE = "approve"
        const val DECISION_REJECT = "reject"
        private const val RESOLVE_PATH = "/approvals/%s/resolve"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_RESOLVE) return
        val id = intent.getStringExtra(EXTRA_APPROVAL_ID) ?: return
        val decision = intent.getStringExtra(EXTRA_DECISION)?.takeIf { it == DECISION_APPROVE || it == DECISION_REJECT } ?: return
        val org = intent.getStringExtra(EXTRA_ORGANIZATION_ID)

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            val keyguard = context.getSystemService(KeyguardManager::class.java)
            if (keyguard?.isKeyguardLocked == true) {
                // Pre-Android 12 has no authentication-required actions: open the approval (the activity needs an unlock).
                DeepLinks.open(context, DeepLinks.approval(id)).send()
                return
            }
        }

        val pending = goAsync()
        Thread {
            try {
                val res = NativeSession.request(context, "POST", RESOLVE_PATH.format(id), JSONObject().put("decision", decision), org)
                when {
                    res.ok -> ApprovalNotifications.showResult(context, id, if (decision == DECISION_APPROVE) "Approved" else "Rejected", null)
                    res.status == 400 || res.status == 409 ->
                        ApprovalNotifications.showResult(context, id, "Couldn't ${decision} this", message(res.body) ?: "It may already be handled. Open Agent Space to check.")
                    else -> ApprovalNotifications.showResult(context, id, "Couldn't ${decision} this", "Open Agent Space to try again.")
                }
                ApprovalsCountWorker.refreshNow(context)
            } catch (e: NativeSession.NotSignedInException) {
                ApprovalNotifications.showResult(context, id, "Sign in to Agent Space", "Open the app to approve or reject.")
            } catch (e: Exception) {
                ApprovalNotifications.showResult(context, id, "Couldn't reach Agent Space", "Check your connection and open the app to try again.")
            } finally {
                pending.finish()
            }
        }.start()
    }

    private fun message(body: String): String? = try {
        JSONObject(body).optString("message").takeIf { it.isNotBlank() }
    } catch (e: Exception) {
        null
    }
}
