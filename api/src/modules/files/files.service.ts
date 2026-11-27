import { BadRequestException, ForbiddenException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { FileArea, FileBucket, MaxFileSize } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { StorageService } from '@/integrations/storage/storage.service';
import { newId } from '@/shared/utils/security/crypto.utils';
import { AccessService } from '../access/access.service';
import type { Actor } from '../bots/bots.service';
import { avatarFileId } from '@/shared/utils/avatar.utils';

const MAX_BYTES: Record<MaxFileSize, number> = { MB_25: 25 * 1024 ** 2, MB_50: 50 * 1024 ** 2, MB_100: 100 * 1024 ** 2 };
const BLOCKED_EXT = /\.(exe|msi|bat|cmd|com|scr|ps1|vbs|jar|sh|app|dmg|apk|dll)$/i;

const PREVIEW_TEXT_MAX_BYTES = 1024 ** 2;
const TEXT_MIME = /^(text\/|application\/(json|xml|javascript|x-yaml|yaml|x-sh|sql|toml|csv))/i;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|xml|ya?ml|toml|ini|log|html?|css|js|jsx|ts|tsx|py|rb|go|rs|java|kt|c|h|cpp|cs|php|sh|sql|svg)$/i;
const SHEET_PREVIEW_MAX_FILE_BYTES = 20 * 1024 ** 2;
const SHEET_PREVIEW_MAX_ROWS = 500;
const SHEET_PREVIEW_MAX_COLS = 50;
const SHEET_EXT = /\.(xlsx|xlsm|xls|ods)$/i;
const SHEET_MIME = /^application\/(vnd\.openxmlformats-officedocument\.spreadsheetml|vnd\.ms-excel|vnd\.oasis\.opendocument\.spreadsheet)/i;
const isSpreadsheet = (mimetype: string, filename: string) => SHEET_MIME.test(mimetype) || SHEET_EXT.test(filename);
const isTextLike = (mimetype: string, filename: string) => TEXT_MIME.test(mimetype) || TEXT_EXT.test(filename);

export type UploadPurpose = 'chat' | 'knowledge' | 'avatar' | 'logo' | 'bot_image' | 'skill';

const PURPOSE: Record<UploadPurpose, { bucket: FileBucket; area: FileArea }> = {
    chat: { bucket: 'FILES', area: 'CHAT' },
    knowledge: { bucket: 'FILES', area: 'KNOWLEDGE' },
    skill: { bucket: 'FILES', area: 'SKILLS' },
    avatar: { bucket: 'PUBLIC', area: 'PUBLIC' },
    logo: { bucket: 'PUBLIC', area: 'PUBLIC' },
    bot_image: { bucket: 'PUBLIC', area: 'PUBLIC' },
};

@Injectable()
export class FilesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
        private readonly access: AccessService,
    ) { }

    /** IDs are random; names, types and owners live in the DB, never in the path (§7.7). */
    private objectPath(orgId: string, area: FileArea, fileId: string) {
        return `orgs/${orgId}/${area.toLowerCase()}/${fileId}`;
    }

    private async maxBytes(orgId: string) {
        const s = await this.prisma.organizationSettings.findUnique({ where: { organization_id: orgId } });
        return MAX_BYTES[s?.max_file_size ?? 'MB_100'];
    }

    async createUpload(actor: Actor, dto: { filename: string; mimetype: string; size: number; purpose: UploadPurpose; conversation_id?: string; bot_id?: string }) {
        const p = PURPOSE[dto.purpose];
        if (!p) throw new BadRequestException('Unknown upload purpose');
        const max = await this.maxBytes(actor.organization_id);
        if (dto.size > max) throw new PayloadTooLargeException(`Files can be at most ${Math.round(max / 1024 ** 2)} MB`);
        if (dto.purpose !== 'chat' && dto.purpose !== 'knowledge' && dto.purpose !== 'skill' && !/^image\//.test(dto.mimetype)) throw new BadRequestException('Images only');
        if (BLOCKED_EXT.test(dto.filename) && dto.purpose !== 'chat') throw new BadRequestException('This file type is not allowed');
        if (dto.conversation_id) await this.access.requireParticipant(dto.conversation_id, actor.user_id);
        if (dto.bot_id) await this.access.requireEditableBot(actor.organization_id, actor.user_id, dto.bot_id);

        const id = newId();
        const path = this.objectPath(actor.organization_id, p.area, id);
        const file = await this.prisma.file.create({
            data: {
                id,
                organization_id: actor.organization_id,
                uploaded_by_id: actor.user_id,
                bucket: p.bucket,
                area: p.area,
                object_path: path,
                filename: dto.filename.slice(0, 255),
                mimetype: dto.mimetype || 'application/octet-stream',
                size: BigInt(dto.size),
                conversation_id: dto.conversation_id,
                bot_id: dto.bot_id,
            },
        });
        const upload = await this.storage.createUploadTarget(p.bucket, path, file.mimetype, dto.size);
        return { file: this.shape(file), upload };
    }

    /** Confirms the object exists and matches the declared size and type before marking the file ready (§7.7). */
    async confirm(actor: Actor, id: string) {
        const file = await this.prisma.file.findFirst({ where: { id, uploaded_by_id: actor.user_id, deleted_at: null } });
        if (!file) throw new NotFoundException('File not found');
        if (file.status === 'READY') return this.shape(file);
        const meta = await this.storage.stat(file.bucket, file.object_path);
        if (!meta) throw new BadRequestException('The upload has not finished');
        const max = await this.maxBytes(actor.organization_id);
        if (meta.size > max || Math.abs(meta.size - Number(file.size)) > 0) {
            await this.prisma.file.update({ where: { id }, data: { status: 'FAILED' } });
            await this.storage.remove(file.bucket, file.object_path);
            throw new BadRequestException('The uploaded file does not match what was declared');
        }
        const updated = await this.prisma.file.update({ where: { id }, data: { status: 'READY' } });
        return this.shape(updated);
    }

    /** Access follows where the file lives: conversation, bot, uploader, or org branding (§7.7). */
    private async assertCanRead(actor: Actor, fileId: string) {
        const f = await this.prisma.file.findFirst({ where: { id: fileId, deleted_at: null, status: 'READY' } });
        if (!f) throw new NotFoundException('File not found');
        if (f.organization_id && f.organization_id !== actor.organization_id) throw new NotFoundException('File not found');
        if (f.uploaded_by_id === actor.user_id) return f;
        if (f.conversation_id && (await this.access.isParticipant(f.conversation_id, actor.user_id))) return f;
        // Files attached to a message the user can see (e.g. a message forwarded into their group) stay readable there.
        if (await this.prisma.messageFile.count({ where: { file_id: f.id, message: { deleted_at: null, conversation: { deleted_at: null, participants: { some: { user_id: actor.user_id, left_at: null } } } } } })) return f;
        if (f.bot_id && (await this.prisma.bot.count({ where: { id: f.bot_id, ...this.access.usableBotsWhere(actor.organization_id, actor.user_id) } }))) return f;
        if (f.bucket === 'PUBLIC') return f;
        throw new ForbiddenException('You do not have access to this file');
    }

    async downloadUrl(actor: Actor, id: string, inline = false) {
        const f = await this.assertCanRead(actor, id);
        const signed = await this.storage.createDownloadUrl(f.bucket, f.object_path, f.filename, inline ? 'inline' : 'attachment');
        return { ...signed, filename: f.filename, mimetype: f.mimetype };
    }

    /** Text content for in-app previews (text-like files only, capped so huge logs stay cheap). */
    async previewText(actor: Actor, id: string) {
        const f = await this.assertCanRead(actor, id);
        if (!isTextLike(f.mimetype, f.filename)) throw new BadRequestException('This file cannot be previewed as text');
        const data = await this.storage.read(f.bucket, f.object_path);
        const truncated = data.length > PREVIEW_TEXT_MAX_BYTES;
        return { text: data.subarray(0, PREVIEW_TEXT_MAX_BYTES).toString('utf8'), truncated, filename: f.filename, mimetype: f.mimetype };
    }

    /** Spreadsheet (xlsx/xls/ods) as display-formatted rows per sheet, capped for in-app previews. */
    async previewSheets(actor: Actor, id: string) {
        const f = await this.assertCanRead(actor, id);
        if (!isSpreadsheet(f.mimetype, f.filename)) throw new BadRequestException('This file is not a spreadsheet');
        if (Number(f.size) > SHEET_PREVIEW_MAX_FILE_BYTES) throw new BadRequestException('This spreadsheet is too large to preview. Download it instead.');
        const data = await this.storage.read(f.bucket, f.object_path);
        const XLSX = await import('xlsx');
        const wb = XLSX.read(data, { type: 'buffer', sheetRows: SHEET_PREVIEW_MAX_ROWS + 1, cellDates: true });
        const sheets = wb.SheetNames.map((name) => {
            const all = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, defval: '', blankrows: false });
            const rows = all.slice(0, SHEET_PREVIEW_MAX_ROWS).map((r) => r.slice(0, SHEET_PREVIEW_MAX_COLS).map((c) => String(c ?? '')));
            const truncated = all.length > SHEET_PREVIEW_MAX_ROWS || all.some((r) => r.length > SHEET_PREVIEW_MAX_COLS);
            return { name, rows, truncated };
        });
        return { sheets, filename: f.filename };
    }

    /** A `file:<id>` avatar seed must point at a ready image in the same organisation. Hash seeds pass untouched. */
    async assertAvatarSeed(orgId: string, seed: string | null | undefined) {
        const fileId = avatarFileId(seed);
        if (!fileId) return;
        const f = await this.prisma.file.findFirst({ where: { id: fileId, organization_id: orgId, deleted_at: null, status: 'READY' } });
        if (!f || !/^image\//.test(f.mimetype)) throw new BadRequestException('That avatar image is not available');
    }

    async get(actor: Actor, id: string) {
        return this.shape(await this.assertCanRead(actor, id));
    }

    async readForTool(orgId: string, id: string) {
        const f = await this.prisma.file.findFirst({ where: { id, organization_id: orgId, deleted_at: null, status: 'READY' } });
        if (!f) throw new NotFoundException('File not found');
        return { file: f, data: await this.storage.read(f.bucket, f.object_path) };
    }

    /** Files bots create (§7.7 "Files bots create") — readable by members of that conversation. */
    async saveGenerated(input: { organization_id: string; user_id: string | null; conversation_id: string; run_id: string; filename: string; mimetype: string; data: Buffer }) {
        const max = await this.maxBytes(input.organization_id);
        if (input.data.length > max) throw new Error('File is larger than the organisation allows');
        const id = newId();
        const path = this.objectPath(input.organization_id, 'GENERATED', id);
        await this.storage.write('FILES', path, input.data, input.mimetype);
        return this.prisma.file.create({
            data: {
                id,
                organization_id: input.organization_id,
                uploaded_by_id: input.user_id,
                bucket: 'FILES',
                area: 'GENERATED',
                object_path: path,
                filename: input.filename,
                mimetype: input.mimetype,
                size: BigInt(input.data.length),
                status: 'READY',
                conversation_id: input.conversation_id,
                run_id: input.run_id,
            },
        });
    }

    shape(f: { id: string; filename: string; mimetype: string; size: bigint; status: string; created_at: Date }) {
        return { id: f.id, filename: f.filename, mimetype: f.mimetype, size: Number(f.size), status: f.status, created_at: f.created_at };
    }
}
