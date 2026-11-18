import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { StorageService } from '@/integrations/storage/storage.service';
import { extractText } from '@/shared/utils/files/text-extract.utils';
import { AccessService } from '../../access/access.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { obj, ToolContext, ToolDef } from './tool.types';

const MAX_READ = 15_000;

/** Knowledge search/read and reading files (chat attachments, skill files, knowledge files) — §6.2, §6.7, §7.7. */
@Injectable()
export class KnowledgeToolsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
        private readonly access: AccessService,
        private readonly knowledge: KnowledgeService,
    ) { }

    async tools(ctx: ToolContext): Promise<ToolDef[]> {
        const t: ToolDef[] = [this.readFile()];
        const hasKnowledge = await this.prisma.knowledgeItem.count({
            where: { organization_id: ctx.organization_id, deleted_at: null, OR: [{ bot_id: ctx.bot.id }, ...(ctx.bot.org_knowledge_enabled ? [{ scope: 'ORGANIZATION' as const }] : [])] },
        });
        if (hasKnowledge) t.push(this.searchKnowledge(), this.readKnowledge());
        return t;
    }

    private searchKnowledge(): ToolDef {
        return {
            name: 'search_knowledge',
            description:
                'Semantic search over your knowledge (files, web pages and notes you were given, plus the organisation library when enabled): returns the passages closest in meaning to the query, best first, with a relevance score (0–1). Use before answering questions about the company, products, policies or anything your knowledge may cover. If results are weak, search again with different wording.',
            parameters: obj({ query: { type: 'string', description: 'A question or a description of the information you need, in natural language (any language).' } }, ['query']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: (a) => `Searching knowledge for "${String(a.query).slice(0, 60)}"`,
            execute: async (a, ctx) => {
                const hits = await this.knowledge.search(ctx.organization_id, ctx.bot, String(a.query));
                return { output: hits.length ? { results: hits, note: 'Use read_knowledge with the id for the full text. Mention the source title when you use it.' } : { results: [], note: 'Nothing relevant found in your knowledge.' } };
            },
        };
    }

    private readKnowledge(): ToolDef {
        return {
            name: 'read_knowledge',
            description: 'Read the full text of one knowledge item by id (from the Knowledge list in your instructions or from search_knowledge). Long items are returned in pages; pass next_offset to continue.',
            parameters: obj({ id: { type: 'string' }, offset: { type: 'number', description: 'Character offset, default 0' } }, ['id']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: () => 'Reading knowledge',
            execute: async (a, ctx) => ({ output: await this.knowledge.read(ctx.organization_id, ctx.bot, String(a.id), Number(a.offset) || 0) }),
        };
    }

    private readFile(): ToolDef {
        return {
            name: 'read_file',
            description: 'Read the text of a file by id: a file attached in this conversation, a file of a skill you are following, or a knowledge file. Works for text, CSV, JSON, Markdown, HTML, PDF, Word, Excel/ODS and PowerPoint files. Long files are returned in pages.',
            parameters: obj({ file_id: { type: 'string' }, offset: { type: 'number', description: 'Character offset, default 0' } }, ['file_id']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: () => 'Reading a file',
            execute: async (a, ctx) => {
                const f = await this.prisma.file.findFirst({ where: { id: String(a.file_id), organization_id: ctx.organization_id, deleted_at: null, status: 'READY' } });
                if (!f) throw new Error('File not found');
                if (!(await this.canRead(ctx, f))) throw new Error('You do not have access to this file');
                const text = await extractText(await this.storage.read(f.bucket, f.object_path), f.mimetype, f.filename);
                if (text === null) return { output: { file_id: f.id, filename: f.filename, error: `${f.mimetype} files can't be read as text.` } };
                const offset = Number(a.offset) || 0;
                return {
                    output: {
                        file_id: f.id,
                        filename: f.filename,
                        total_characters: text.length,
                        offset,
                        text: text.slice(offset, offset + MAX_READ),
                        more: offset + MAX_READ < text.length ? { next_offset: offset + MAX_READ } : null,
                    },
                };
            },
        };
    }

    /** Same rules as for people (§7.7): conversation files for its members, skill files for skills the user can use, knowledge for the bot. */
    private async canRead(ctx: ToolContext, f: { id: string; conversation_id: string | null; skill_id: string | null }) {
        if (f.conversation_id && ctx.conversation_id === f.conversation_id) return true;
        if (f.conversation_id && ctx.actor && (await this.access.isParticipant(f.conversation_id, ctx.actor.user_id))) return true;
        if (ctx.actor) {
            const skillFile = await this.prisma.skillFile.findFirst({ where: { file_id: f.id, skill: this.access.usableSkillsWhere(ctx.organization_id, ctx.actor.user_id) } });
            if (skillFile) return true;
        }
        const k = await this.prisma.knowledgeItem.findFirst({ where: { file_id: f.id, deleted_at: null, OR: [{ bot_id: ctx.bot.id }, ...(ctx.bot.org_knowledge_enabled ? [{ scope: 'ORGANIZATION' as const }] : [])] } });
        return !!k;
    }
}
