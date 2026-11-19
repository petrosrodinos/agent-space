import type { MessagePart } from './tools/tool.types';

const FOLLOW_UPS_LINE = /\[\[followups:([^\]]*)\]\]/;
const FOLLOW_UPS_LINES = /\s*\[\[followups:[^\]]*\]\]\s*/g;
export const MAX_FOLLOW_UPS = 3;

/**
 * Pulls "[[followups: a || b || c]]" out of text parts (mutating them) and returns the suggestions, so they render
 * as clickable chips under the message instead of raw text. Text parts left empty are removed.
 */
export function extractFollowUps(parts: MessagePart[]): { parts: MessagePart[]; followUps: string[] } {
    const followUps: string[] = [];
    for (const p of parts) {
        if (p.type !== 'text') continue;
        const text = String(p.text ?? '');
        const m = FOLLOW_UPS_LINE.exec(text);
        if (m) followUps.push(...m[1].split('||').map((s) => s.trim()).filter(Boolean));
        p.text = text.replace(FOLLOW_UPS_LINES, '').trimEnd();
    }
    return { parts: parts.filter((p) => !(p.type === 'text' && !String(p.text ?? '').trim())), followUps: followUps.slice(0, MAX_FOLLOW_UPS) };
}
