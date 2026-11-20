/** What a notification needs to become an FCM message. */
export interface FcmNotification {
    id: string;
    organization_id: string | null;
    title: string;
    body: string | null;
    link_path: string | null;
    event: string;
    is_urgent: boolean;
    data: unknown;
}

export const FcmDataKinds = { APPROVAL: 'approval' } as const;

/**
 * FCM HTTP v1 message for the Android app (§12, §14.2).
 * Approvals go data-only (no `notification` block), so the app builds the notification itself with Approve / Reject
 * buttons, or no buttons when fingerprint / face unlock is needed. Everything in `data` must be a string.
 * Other notifications are shown by Android directly.
 */
export function fcmMessage(token: string, n: FcmNotification): Record<string, unknown> {
    const data = (n.data && typeof n.data === 'object' ? n.data : {}) as Record<string, unknown>;
    if (n.event === 'APPROVAL_NEEDED' && typeof data.approval_id === 'string' && n.organization_id) {
        return {
            token,
            android: { priority: 'HIGH' },
            data: {
                kind: FcmDataKinds.APPROVAL,
                id: n.id,
                approval_id: data.approval_id,
                organization_id: n.organization_id,
                title: n.title,
                body: n.body ?? '',
                requires_biometric: data.requires_biometric === true ? 'true' : 'false',
                url: `/approvals/${data.approval_id}`,
            },
        };
    }
    return {
        token,
        notification: { title: n.title, body: n.body ?? '' },
        data: { id: n.id, url: n.link_path ?? '/', event: n.event },
        android: { priority: n.is_urgent ? 'HIGH' : 'NORMAL', notification: { tag: n.id } },
    };
}
