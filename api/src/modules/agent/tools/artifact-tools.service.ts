import { Injectable } from '@nestjs/common';
import { ArtifactType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ArtifactsService } from '../../artifacts/artifacts.service';
import { ARTIFACT_TYPES, MAX_ARTIFACT_HTML } from '../../artifacts/dto/artifact.dto';
import { obj, ToolContext, ToolDef } from './tool.types';

const READ_CHUNK = 12_000;

const BUILD_GUIDE = (brand: string) => `Write ONE complete, self-contained HTML document (<!doctype html>…). Rules:
- Fully designed and polished: real layout, spacing, typography, icons (inline SVG), and real content — never lorem ipsum.
- Responsive (phone → desktop) and works in light and dark mode (prefers-color-scheme). Use the organisation brand colour ${brand} as the accent unless asked otherwise.
- You may load libraries only from https://cdn.jsdelivr.net, https://unpkg.com, https://cdnjs.cloudflare.com, https://esm.sh or https://cdn.tailwindcss.com (e.g. Tailwind Play CDN, React 18 UMD + ReactDOM UMD + @babel/standalone for JSX with <script type="text/babel">, Chart.js, Mermaid). Fonts from Google Fonts. No other network access is allowed.
- To SAVE information visitors enter (form responses, votes, tracker items, sign-ups) call: await window.agentspace.save("collection", {…}); to read shared entries back: await window.agentspace.list("collection") → {records:[{id,data,created_at}]}. Name a collection "private_…" when entries must stay private (e.g. form responses with emails) — only owners/editors see those in Agent Space. Never use <form action>; handle submit in JS and show a success state.
- For AI features (e.g. a "Summarise" button or a chat box) call: await window.agentspace.ai(prompt) → text.
- For LIVE data from the viewer's own connected accounts (members only; e.g. "this week's deals"), call a READ action of a connected service by its tool name: const data = await window.agentspace.live("HUBSPOT_LIST_DEALS", {limit: 20}). Each viewer sees only what their own account can see, and is asked once to allow it. Only read actions work. On public links live() throws, so show saved information or a friendly message instead; always handle errors.
- For FILE UPLOADS from visitors (e.g. a CV on a job form) use <input type="file"> and call: const ref = await window.agentspace.upload(file) → {type:"file", id, filename, mimetype, size}; then save the ref inside the record, e.g. agentspace.save("private_applications", {name, email, cv: ref}). Max 10 MB; PDF, images, Word/Excel/PowerPoint, text, CSV or ZIP. Owners download the files from the Data tab; the page itself can't read them back.
- Slides: one <section class="slide"> per slide filling a 16:9 viewport, showing one slide at a time; ArrowRight/ArrowLeft move between slides (PowerPoint/PDF export steps through them this way). Documents/reports: print-friendly styles (@media print).
- No secrets, keys or personal data in the source.`;

/** Bot tools for artifacts (§7.5): build, edit, list, read and review stored entries. */
@Injectable()
export class ArtifactToolsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly artifacts: ArtifactsService,
    ) { }

    async tools(ctx: ToolContext): Promise<ToolDef[]> {
        if (!ctx.actor) return [];
        const org = await this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { brand_color: true } });
        const brand = org?.brand_color || '#6B4EFF';
        return [this.create(brand), this.update(brand), this.list(), this.read(), this.records()];
    }

    private async part(ctx: ToolContext, artifactId: string, action: 'created' | 'updated', version: number, status: string) {
        const a = await this.artifacts.get(ctx.actor!, artifactId);
        await ctx.addPart({ type: 'artifact', artifact_id: a.id, title: a.title, artifact_type: a.type, version, status: status === 'DRAFT' ? 'draft' : 'published', action, description: a.description });
        return a;
    }

    private create(brand: string): ToolDef {
        return {
            name: 'create_artifact',
            description: `Create an artifact: a standalone, shareable app, dashboard, landing page, report/document, slide deck, diagram, form, tool or game with its own link, shown to the user in a side panel. Use it when the user asks to build/make something they will open, share or reuse — not for quick answers in chat (use show_ui for in-chat interactive replies). After creating, tell the user briefly what you built; don't paste the code.\n\n${BUILD_GUIDE(brand)}`,
            parameters: obj(
                {
                    title: { type: 'string', description: 'Short title, e.g. "Q4 webinar landing page"' },
                    type: { type: 'string', enum: [...ARTIFACT_TYPES] },
                    description: { type: 'string', description: 'One sentence about what it is' },
                    html: { type: 'string', description: 'The complete HTML document' },
                },
                ['title', 'type', 'html'],
            ),
            step_type: 'ARTIFACT_EDIT',
            runs_on: 'server',
            title: (a) => `Building “${String(a.title ?? 'artifact').slice(0, 60)}”`,
            execute: async (args, ctx) => {
                const html = String(args.html ?? '');
                if (html.length > MAX_ARTIFACT_HTML) throw new Error('The document is too large — simplify it.');
                const res = await this.artifacts.createFromBot({
                    organization_id: ctx.organization_id,
                    owner_id: ctx.actor!.user_id,
                    conversation_id: ctx.is_temporary ? null : ctx.conversation_id,
                    message_id: null,
                    run_id: ctx.run.id,
                    title: String(args.title).slice(0, 120),
                    type: (ARTIFACT_TYPES as readonly string[]).includes(args.type) ? (args.type as ArtifactType) : 'OTHER',
                    description: args.description ? String(args.description) : null,
                    html,
                });
                const a = await this.part(ctx, res.artifact.id, 'created', 1, 'PUBLISHED');
                return { output: { artifact_id: a.id, title: a.title, version: 1, sharing: 'private (only the user) — they can share it from the artifact panel', link: a.url } };
            },
        };
    }

    private update(brand: string): ToolDef {
        return {
            name: 'update_artifact',
            description: `Change an existing artifact (creates a new version; with "Review before publishing" it becomes a draft). Provide either the full new \`html\`, or \`edits\` — exact find/replace pairs on the current source (read it first with read_artifact). Always give a short change_summary ("Made the header blue").\n\n${BUILD_GUIDE(brand)}`,
            parameters: obj(
                {
                    artifact_id: { type: 'string' },
                    change_summary: { type: 'string', description: 'What changed, in a few words' },
                    html: { type: 'string', description: 'Complete new HTML document (omit when using edits)' },
                    edits: {
                        type: 'array',
                        description: 'Exact find/replace edits applied in order to the current source',
                        items: { type: 'object', properties: { find: { type: 'string' }, replace: { type: 'string' } }, required: ['find', 'replace'] },
                    },
                    title: { type: 'string', description: 'New title (optional)' },
                },
                ['artifact_id', 'change_summary'],
            ),
            step_type: 'ARTIFACT_EDIT',
            runs_on: 'server',
            title: (a) => `Updating the artifact${a.change_summary ? `: ${String(a.change_summary).slice(0, 60)}` : ''}`,
            execute: async (args, ctx) => {
                let html: string;
                if (typeof args.html === 'string' && args.html.trim()) {
                    html = args.html;
                } else if (Array.isArray(args.edits) && args.edits.length) {
                    const current = await this.artifacts.source(ctx.actor!, String(args.artifact_id));
                    html = current.artifact.draft_version_id ? (await this.artifacts.source(ctx.actor!, String(args.artifact_id), current.artifact.draft_version_id)).html : current.html;
                    for (const [i, e] of (args.edits as { find: string; replace: string }[]).entries()) {
                        const at = html.indexOf(String(e.find));
                        if (!e.find || at < 0) throw new Error(`Edit ${i + 1}: the text to find was not in the current source. Read the artifact again and retry.`);
                        html = html.slice(0, at) + String(e.replace) + html.slice(at + String(e.find).length);
                    }
                } else {
                    throw new Error('Provide html or edits');
                }
                const res = await this.artifacts.saveVersion(ctx.actor!, String(args.artifact_id), { html, change_summary: String(args.change_summary ?? '').slice(0, 300) || null, run_id: ctx.run.id, title: args.title ? String(args.title) : undefined });
                const a = await this.part(ctx, res.artifact_id, 'updated', res.version, res.status);
                return { output: { artifact_id: a.id, version: res.version, status: res.status === 'DRAFT' ? 'saved as a draft — an editor must click Publish' : 'published', link: a.url } };
            },
        };
    }

    private list(): ToolDef {
        return {
            name: 'list_artifacts',
            description: 'List artifacts the user can open (id, title, type, their role, sharing). Use it to find an artifact to change or reuse.',
            parameters: obj({ search: { type: 'string' }, this_conversation_only: { type: 'boolean' } }),
            step_type: 'ARTIFACT_EDIT',
            runs_on: 'server',
            title: () => 'Looking through artifacts',
            execute: async (args, ctx) => {
                const rows = await this.artifacts.list(ctx.actor!, { tab: 'all', search: args.search ? String(args.search).slice(0, 80) : undefined, conversation_id: args.this_conversation_only && ctx.conversation_id ? ctx.conversation_id : undefined });
                return { output: rows.slice(0, 40).map((a) => ({ id: a.id, title: a.title, type: a.type, role: a.role, sharing: a.sharing_level, version: a.version, has_draft: a.has_draft, updated_at: a.updated_at })) };
            },
        };
    }

    private read(): ToolDef {
        return {
            name: 'read_artifact',
            description: `Read an artifact's current HTML source (or its draft), in chunks of ${READ_CHUNK} characters. Call again with the next offset until done.`,
            parameters: obj({ artifact_id: { type: 'string' }, offset: { type: 'integer', minimum: 0 }, draft: { type: 'boolean', description: 'Read the unpublished draft instead' } }, ['artifact_id']),
            step_type: 'ARTIFACT_EDIT',
            runs_on: 'server',
            title: () => 'Reading the artifact',
            execute: async (args, ctx) => {
                const base = await this.artifacts.source(ctx.actor!, String(args.artifact_id));
                const src = args.draft && base.artifact.draft_version_id ? await this.artifacts.source(ctx.actor!, String(args.artifact_id), base.artifact.draft_version_id) : base;
                const offset = Math.max(0, Number(args.offset) || 0);
                const chunk = src.html.slice(offset, offset + READ_CHUNK);
                return {
                    output: {
                        artifact_id: src.artifact.id,
                        title: src.artifact.title,
                        version: src.version.version,
                        status: src.version.status,
                        total_length: src.html.length,
                        offset,
                        next_offset: offset + chunk.length < src.html.length ? offset + chunk.length : null,
                        html: chunk,
                    },
                };
            },
        };
    }

    private records(): ToolDef {
        return {
            name: 'get_artifact_records',
            description: 'Read the information an artifact has stored (form responses, votes, tracker items) to review or summarise it. Only for artifacts the user can edit.',
            parameters: obj({ artifact_id: { type: 'string' }, collection: { type: 'string' } }, ['artifact_id']),
            step_type: 'ARTIFACT_EDIT',
            runs_on: 'server',
            title: () => 'Reading stored responses',
            execute: async (args, ctx) => {
                const r = await this.artifacts.records(ctx.actor!, String(args.artifact_id), args.collection ? String(args.collection) : undefined);
                return { output: { collections: r.collections, records: r.records.slice(0, 200).map((x) => ({ collection: x.collection, data: x.data, from: x.submitted_by?.name ?? x.submitted_by?.email ?? 'visitor', at: x.created_at })) } };
            },
        };
    }
}
