package com.agentspace.app.approvals

import com.agentspace.app.widgets.ApprovalsCountWorker
import com.capacitorjs.plugins.pushnotifications.MessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Replaces @capacitor/push-notifications' MessagingService in the manifest (only one service may receive FCM).
 * Approval data messages become a native notification with Approve / Reject; everything still goes to the plugin,
 * so the web app's `pushNotificationReceived` / token listeners keep working.
 */
class AgentSpaceMessagingService : MessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val approval = if (remoteMessage.notification == null) ApprovalPush.from(remoteMessage.data) else null
        if (approval != null) {
            ApprovalNotifications.show(this, approval)
            ApprovalsCountWorker.refreshNow(this)
        }
        super.onMessageReceived(remoteMessage)
    }
}
