const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Branded email shell using DESIGN.MD tokens (cream canvas, Grape action colour, plum text). */
function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
    return `<!doctype html><html><body style="margin:0;background:#FFFBF5;font-family:'Plus Jakarta Sans',Segoe UI,Roboto,Arial,sans-serif;color:#1C1633">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBF5;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:1px solid #EDE3D6;border-radius:20px;box-shadow:0 2px 0 rgba(28,22,51,0.08)">
<tr><td style="padding:28px 28px 8px"><div style="display:inline-block;width:40px;height:40px;border-radius:14px;background:#6B4EFF;text-align:center;line-height:40px;font-size:22px">🤖</div>
<span style="font-weight:800;font-size:17px;margin-left:10px;vertical-align:middle">Agent Space</span></td></tr>
<tr><td style="padding:8px 28px 0"><h1 style="font-size:24px;line-height:1.2;margin:12px 0 8px;font-weight:700">${esc(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#3A3352">${bodyHtml}</div></td></tr>
${cta ? `<tr><td style="padding:20px 28px 4px"><a href="${esc(cta.url)}" style="display:inline-block;background:#6B4EFF;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:9999px">${esc(cta.label)}</a></td></tr>
<tr><td style="padding:8px 28px 0;font-size:12px;color:#6E6787">Or paste this link into your browser:<br><span style="word-break:break-all">${esc(cta.url)}</span></td></tr>` : ''}
<tr><td style="padding:24px 28px 28px;font-size:12px;color:#9A93AE">You received this email because of your Agent Space account.</td></tr>
</table></td></tr></table></body></html>`;
}

export const MailTemplates = {
    invitation(p: { inviterName: string; orgName: string; role: string; url: string; expiresInDays: number }) {
        return {
            subject: `${p.inviterName} invited you to ${p.orgName} on Agent Space`,
            html: layout(
                `Join ${p.orgName} on Agent Space`,
                `<p><strong>${esc(p.inviterName)}</strong> invited you to join <strong>${esc(p.orgName)}</strong> as <strong>${esc(p.role)}</strong>.</p><p>This invitation expires in ${p.expiresInDays} day${p.expiresInDays === 1 ? '' : 's'}.</p>`,
                { label: 'Accept invitation', url: p.url },
            ),
            text: `${p.inviterName} invited you to join ${p.orgName} as ${p.role}. Accept: ${p.url}`,
        };
    },
    passwordReset(p: { url: string }) {
        return {
            subject: 'Reset your Agent Space password',
            html: layout('Reset your password', `<p>We received a request to reset your password. The link is valid for 1 hour. If you didn't ask for this, you can ignore this email.</p>`, {
                label: 'Choose a new password',
                url: p.url,
            }),
            text: `Reset your password: ${p.url} (valid for 1 hour)`,
        };
    },
    notification(p: { title: string; body?: string | null; url?: string | null }) {
        return {
            subject: p.title,
            html: layout(p.title, p.body ? `<p>${esc(p.body)}</p>` : '', p.url ? { label: 'Open in Agent Space', url: p.url } : undefined),
            text: `${p.title}\n${p.body ?? ''}\n${p.url ?? ''}`,
        };
    },
};
