/**
 * Builds the HTML served on the isolated artifact address (§7.5).
 *
 * Isolation: every response carries a CSP `sandbox` directive without `allow-same-origin`, so the document
 * always runs in an opaque origin — even when opened directly — and can never read the API's cookies or
 * storage. The app additionally embeds it in a sandboxed iframe. Artifacts reach the platform only through
 * the tiny `window.agentspace` runtime injected here, which talks to the public record/AI endpoints with a
 * short-lived session token scoped to this one artifact.
 */

/** CDNs artifacts may load scripts, styles and fonts from (React UMD, Tailwind, chart libraries, icons). */
const SCRIPT_CDNS = ['https://cdn.jsdelivr.net', 'https://unpkg.com', 'https://cdn.tailwindcss.com', 'https://cdnjs.cloudflare.com', 'https://esm.sh'];
const STYLE_CDNS = ['https://fonts.googleapis.com', 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://unpkg.com'];

export function artifactCsp(opts: { apiOrigin: string; frameAncestors: string[] | '*' }) {
    const ancestors = opts.frameAncestors === '*' ? '*' : opts.frameAncestors.length ? opts.frameAncestors.join(' ') : "'none'";
    return [
        "default-src 'none'",
        `script-src 'unsafe-inline' 'unsafe-eval' blob: ${SCRIPT_CDNS.join(' ')}`,
        `style-src 'unsafe-inline' ${STYLE_CDNS.join(' ')}`,
        `font-src data: https://fonts.gstatic.com ${STYLE_CDNS.join(' ')}`,
        'img-src * data: blob:',
        'media-src * data: blob:',
        `connect-src ${opts.apiOrigin} ${SCRIPT_CDNS.join(' ')}`,
        "form-action 'none'",
        "base-uri 'none'",
        `frame-ancestors ${ancestors}`,
        'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads',
    ].join('; ');
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function runtimeScript(cfg: { endpoint: string; session: string; isPublic: boolean; aiEnabled: boolean; reportUrl: string | null }) {
    const json = JSON.stringify(cfg).replace(/</g, '\\u003c');
    return `<script>(function(){var C=${json};
function call(path,body){return fetch(C.endpoint+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'text/plain'}:undefined,body:body?JSON.stringify(Object.assign({session:C.session},body)):undefined}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j&&j.message||'Request failed');return j;});});}
window.agentspace={
save:function(collection,data){return call('/records',{collection:String(collection),data:data});},
list:function(collection){return call('/records?collection='+encodeURIComponent(collection)+'&session='+encodeURIComponent(C.session));},
upload:function(file){if(!(file instanceof Blob))return Promise.reject(new Error('Pass a File from an <input type=file>'));var fd=new FormData();fd.append('file',file,file.name||'file');return fetch(C.endpoint+'/files?session='+encodeURIComponent(C.session),{method:'POST',body:fd}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j&&j.message||'Upload failed');return j;});});},
live:function(action,params){var go=function(){return fetch(C.endpoint+'/live',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({session:C.session,action:String(action),params:params||{}})}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});});};
return go().then(function(x){if(x.ok)return x.j.data;var p=x.j||{};if(p.code==='needs_permission'&&window.parent!==window){return new Promise(function(res,rej){var id=Math.random().toString(36).slice(2);function on(ev){var d=ev.data;if(!d||d.type!=='agentspace:permission-result'||d.id!==id)return;window.removeEventListener('message',on);if(!d.granted)return rej(new Error('Access to '+p.service_name+' was not allowed'));go().then(function(y){if(y.ok)res(y.j.data);else rej(new Error(y.j&&y.j.message||'Request failed'));});}window.addEventListener('message',on);window.parent.postMessage({type:'agentspace:permission',id:id,service:p.service,service_name:p.service_name},'*');});}
throw new Error(typeof p.message==='string'?p.message:'Request failed');});},
ai:function(prompt){if(!C.aiEnabled)return Promise.reject(new Error('AI is switched off for this artifact'));return call('/ai',{prompt:String(prompt)}).then(function(j){return j.text;});},
isPublic:C.isPublic};
document.addEventListener('submit',function(e){var f=e.target;if(f&&f.tagName==='FORM'&&!f.hasAttribute('data-agentspace-ignore')){e.preventDefault();}},true);
${cfg.reportUrl ? `window.addEventListener('DOMContentLoaded',function(){var a=document.createElement('a');a.href=C.reportUrl;a.target='_blank';a.rel='noopener';a.textContent='Report';a.setAttribute('style','position:fixed;right:10px;bottom:8px;z-index:2147483647;font:600 11px system-ui,sans-serif;color:#6b6480;background:rgba(255,255,255,.85);padding:3px 8px;border-radius:999px;text-decoration:none;box-shadow:0 1px 3px rgba(0,0,0,.12)');document.body.appendChild(a);});` : ''}
})();</script>`;
}

/** Injects the runtime (and robots meta) into the bot-written document. Works with or without a <head>. */
export function renderArtifactHtml(
    html: string,
    opts: { title: string; endpoint: string; session: string; isPublic: boolean; aiEnabled: boolean; allowIndexing: boolean; reportUrl: string | null },
) {
    const inject = `${opts.allowIndexing ? '' : '<meta name="robots" content="noindex,nofollow">'}${runtimeScript(opts)}`;
    let doc = html.trim();
    if (!/<html[\s>]/i.test(doc)) {
        doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head><body>${doc}</body></html>`;
    }
    if (/<head[^>]*>/i.test(doc)) return doc.replace(/<head[^>]*>/i, (m) => `${m}${inject}`);
    return doc.replace(/<html[^>]*>/i, (m) => `${m}<head>${inject}</head>`);
}

/** Small branded pages for "password needed", "not found" and errors, served under the same strict CSP. */
export function messagePage(title: string, body: string, form?: { action: string }) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FBF7F0;color:#1C1633;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
@media (prefers-color-scheme:dark){body{background:#15121F;color:#F4F0FF}.card{background:#211C31!important;border-color:#352E4A!important}input{background:#15121F!important;color:inherit;border-color:#352E4A!important}}
.card{background:#fff;border:1px solid #E8E1D6;border-radius:24px;padding:28px;max-width:380px;width:calc(100% - 32px);box-shadow:0 2px 0 #E8E1D6}
h1{font-size:20px;margin:0 0 6px}p{margin:0 0 16px;color:#6B6480}input{width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid #E8E1D6;border-radius:14px;font:inherit;margin-bottom:12px}
button{width:100%;padding:12px;border:0;border-radius:999px;background:#6B4EFF;color:#fff;font:600 15px system-ui,sans-serif;cursor:pointer}</style></head>
<body><div class="card"><h1>${esc(title)}</h1><p>${esc(body)}</p>${form ? `<form method="post" action="${esc(form.action)}"><input type="password" name="password" placeholder="Password" autofocus required aria-label="Password"><button type="submit">Open</button></form>` : ''}</div></body></html>`;
}

export function reportPage(title: string, action: string, done = false) {
    const page = messagePage(done ? 'Thanks for letting us know' : `Report “${title}”`, done ? 'Our team will review this artifact.' : 'Tell us what is wrong with this page (spam, phishing, abuse, illegal content…).');
    if (done) return page;
    return page.replace(
        '</div></body>',
        `<form method="post" action="${esc(action)}"><textarea name="reason" required minlength="3" maxlength="2000" rows="4" placeholder="What's wrong?" aria-label="Reason" style="width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid #E8E1D6;border-radius:14px;font:inherit;margin-bottom:12px;background:inherit;color:inherit"></textarea><input type="email" name="email" placeholder="Your email (optional)" aria-label="Email"><button type="submit">Send report</button></form></div></body>`,
    );
}

export function messagePageCsp(frameAncestors: string[] | '*') {
    const ancestors = frameAncestors === '*' ? '*' : frameAncestors.length ? frameAncestors.join(' ') : "'none'";
    return `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors ${ancestors}`;
}
