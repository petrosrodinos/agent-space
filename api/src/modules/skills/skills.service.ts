import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Skill, SkillRole } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { shortSuffix, slugify } from '@/shared/utils/security/crypto.utils';
import { AccessService, isAdminRole } from '../access/access.service';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSkillDto, ShareSkillDto, SkillQuery, UpdateSkillDto } from './dto/skill.dto';

const RESTORE_WINDOW_MS = 30 * 86400_000;

@Injectable()
export class SkillsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
        private readonly notifications: NotificationsService,
    ) { }

    /** Owner → OWNER; shared Editor → EDITOR; anyone who can see it → USER; null = no access (§6.7). */
    private async roleOn(actor: Actor, skill: Skill & { shares?: { user_id: string; role: SkillRole }[] }): Promise<SkillRole | null> {
        if (skill.is_starter) return 'USER';
        if (skill.organization_id !== actor.organization_id) return null;
        if (skill.owner_id === actor.user_id) return 'OWNER';
        const shares = skill.shares ?? (await this.prisma.skillShare.findMany({ where: { skill_id: skill.id } }));
        const mine = shares.find((s) => s.user_id === actor.user_id);
        if (mine) return mine.role;
        if (skill.sharing_level === 'ORGANIZATION') return 'USER';
        return null;
    }

    private async requireRole(actor: Actor, id: string, min: SkillRole, includeDeleted = false) {
        const skill = await this.prisma.skill.findFirst({ where: { id, ...(includeDeleted ? {} : { deleted_at: null }) }, include: { shares: true } });
        if (!skill) throw new NotFoundException('Skill not found');
        const role = await this.roleOn(actor, skill);
        const rank = { OWNER: 3, EDITOR: 2, USER: 1 } as const;
        if (!role) throw new NotFoundException('Skill not found');
        if (rank[role] < rank[min]) throw new ForbiddenException(min === 'OWNER' ? 'Only the skill owner can do this' : 'You need edit access to this skill');
        return { skill, role };
    }

    async list(actor: Actor, q: SkillQuery) {
        const base = this.access.usableSkillsWhere(actor.organization_id, actor.user_id);
        const tabWhere: Prisma.SkillWhereInput =
            q.tab === 'mine'
                ? { organization_id: actor.organization_id, owner_id: actor.user_id, deleted_at: null }
                : q.tab === 'shared'
                    ? { organization_id: actor.organization_id, deleted_at: null, shares: { some: { user_id: actor.user_id } } }
                    : q.tab === 'organization'
                        ? { organization_id: actor.organization_id, sharing_level: 'ORGANIZATION', deleted_at: null }
                        : q.tab === 'starter'
                            ? { organization_id: null, is_starter: true, deleted_at: null }
                            : q.tab === 'deleted'
                                ? { organization_id: actor.organization_id, owner_id: actor.user_id, deleted_at: { gt: new Date(Date.now() - RESTORE_WINDOW_MS) } }
                                : base;
        const settings = await this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } });
        const rows = await this.prisma.skill.findMany({
            where: {
                AND: [
                    tabWhere,
                    ...(settings?.starter_skills_enabled === false ? [{ is_starter: false }] : []),
                    ...(q.search ? [{ OR: [{ name: { contains: q.search, mode: 'insensitive' as const } }, { description: { contains: q.search, mode: 'insensitive' as const } }, { slug: { contains: q.search.toLowerCase() } }] }] : []),
                ],
            },
            include: {
                owner: { select: { id: true, name: true } },
                bots: { where: { bot: { organization_id: actor.organization_id, deleted_at: null } }, include: { bot: { select: { id: true, name: true, emoji: true, color: true } } } },
                shares: true,
            },
            orderBy: [{ is_starter: 'asc' }, { updated_at: 'desc' }],
        });
        const out = [];
        for (const s of rows) {
            out.push({
                id: s.id,
                name: s.name,
                emoji: s.emoji,
                slug: s.slug,
                description: s.description,
                sharing_level: s.sharing_level,
                is_starter: s.is_starter,
                owner: s.owner,
                current_version: s.current_version,
                updated_at: s.updated_at,
                deleted_at: s.deleted_at,
                bots: s.bots.map((b) => b.bot),
                my_role: s.deleted_at ? 'OWNER' : await this.roleOn(actor, s),
            });
        }
        return out;
    }

    async get(actor: Actor, id: string) {
        const { role } = await this.requireRole(actor, id, 'USER');
        const s = await this.prisma.skill.findUniqueOrThrow({
            where: { id },
            include: {
                owner: { select: { id: true, name: true, email: true } },
                shares: { include: { user: { select: { id: true, name: true, email: true } } } },
                bots: { where: { bot: { organization_id: actor.organization_id, deleted_at: null } }, include: { bot: { select: { id: true, name: true, emoji: true, color: true } } } },
                versions: { orderBy: { version: 'desc' }, take: 50, include: { created_by: { select: { id: true, name: true } } } },
                files: { where: { file: { deleted_at: null } }, include: { file: { select: { id: true, filename: true, mimetype: true, size: true, created_at: true } } }, orderBy: { created_at: 'asc' } },
            },
        });
        return { ...s, bots: s.bots.map((b) => b.bot), files: s.files.map((f) => ({ ...f.file, size: Number(f.file.size) })), my_role: role };
    }

    private async uniqueSlug(orgId: string, wanted: string) {
        const base = slugify(wanted, 50);
        const clash = await this.prisma.skill.findFirst({ where: { organization_id: orgId, slug: base } });
        return clash ? `${base}-${shortSuffix()}` : base;
    }

    async create(actor: Actor, dto: CreateSkillDto & { imported_from?: string }) {
        const s = await this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } });
        if (s?.who_can_create_skills === 'OWNERS_ADMINS' && !isAdminRole(actor.role)) throw new ForbiddenException('Only Owners and Admins can create skills here');
        const slug = await this.uniqueSlug(actor.organization_id, dto.slug || dto.name);
        const questions = (dto.questions ?? []) as unknown as Prisma.InputJsonValue;
        const required_tools = (dto.required_services ?? []).map((service_key) => ({ service_key })) as unknown as Prisma.InputJsonValue;
        const skill = await this.prisma.skill.create({
            data: {
                organization_id: actor.organization_id,
                owner_id: actor.user_id,
                name: dto.name.trim(),
                emoji: dto.emoji,
                slug,
                description: dto.description,
                instructions: dto.instructions,
                questions,
                required_tools,
                result: dto.result,
                imported_from: dto.imported_from,
                versions: {
                    create: { version: 1, name: dto.name.trim(), emoji: dto.emoji, description: dto.description, instructions: dto.instructions, questions, required_tools, result: dto.result, created_by_id: actor.user_id, change_summary: dto.imported_from ? 'Imported' : 'Created' },
                },
            },
        });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'skill.created', target_type: 'skill', target_id: skill.id, metadata: { slug } });
        return skill;
    }

    /** Every change creates a new version (§6.7). */
    async update(actor: Actor, id: string, dto: UpdateSkillDto) {
        const { skill } = await this.requireRole(actor, id, 'EDITOR');
        if (skill.is_starter) throw new BadRequestException('Starter skills can\'t be edited — add a copy to your skills first');
        const slug = dto.slug && dto.slug !== skill.slug ? await this.uniqueSlug(actor.organization_id, dto.slug) : skill.slug;
        const next = {
            name: dto.name?.trim() ?? skill.name,
            emoji: dto.emoji ?? skill.emoji,
            description: dto.description ?? skill.description,
            instructions: dto.instructions ?? skill.instructions,
            questions: (dto.questions ?? skill.questions) as Prisma.InputJsonValue,
            required_tools: (dto.required_services ? dto.required_services.map((service_key) => ({ service_key })) : skill.required_tools) as Prisma.InputJsonValue,
            result: dto.result ?? skill.result,
        };
        const version = skill.current_version + 1;
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.skillVersion.create({ data: { skill_id: id, version, ...next, created_by_id: actor.user_id, change_summary: dto.change_summary ?? 'Edited' } });
            return tx.skill.update({ where: { id }, data: { ...next, slug, current_version: version } });
        });
        await this.notifyChange(actor, skill, `${skill.name} was updated`);
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'skill.updated', target_type: 'skill', target_id: id, metadata: { version } });
        return updated;
    }

    async restoreVersion(actor: Actor, id: string, versionNo: number) {
        const { skill } = await this.requireRole(actor, id, 'EDITOR');
        const v = await this.prisma.skillVersion.findUnique({ where: { skill_id_version: { skill_id: id, version: versionNo } } });
        if (!v) throw new NotFoundException('Version not found');
        const version = skill.current_version + 1;
        const data = { name: v.name, emoji: v.emoji, description: v.description, instructions: v.instructions, questions: v.questions as Prisma.InputJsonValue, required_tools: v.required_tools as Prisma.InputJsonValue, result: v.result };
        await this.prisma.$transaction([
            this.prisma.skillVersion.create({ data: { skill_id: id, version, ...data, created_by_id: actor.user_id, restored_from_version: versionNo, change_summary: `Restored version ${versionNo}` } }),
            this.prisma.skill.update({ where: { id }, data: { ...data, current_version: version } }),
        ]);
        return this.get(actor, id);
    }

    /** Deleted skills are removed from all bots and can be restored for 30 days. */
    async remove(actor: Actor, id: string) {
        const { skill } = await this.requireRole(actor, id, 'OWNER');
        if (skill.is_starter) throw new BadRequestException('Starter skills cannot be deleted');
        await this.prisma.$transaction([
            this.prisma.skill.update({ where: { id }, data: { deleted_at: new Date() } }),
            this.prisma.botSkill.deleteMany({ where: { skill_id: id } }),
        ]);
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'skill.deleted', target_type: 'skill', target_id: id });
        return { ok: true };
    }

    /** Skill files (§6.7, §7.7): templates, examples and guides the bot reads when it follows the skill. */
    async addFile(actor: Actor, id: string, fileId: string) {
        await this.requireRole(actor, id, 'EDITOR');
        const file = await this.prisma.file.findFirst({ where: { id: fileId, organization_id: actor.organization_id, uploaded_by_id: actor.user_id, status: 'READY', deleted_at: null } });
        if (!file) throw new BadRequestException('Upload the file first');
        if ((await this.prisma.skillFile.count({ where: { skill_id: id } })) >= 20) throw new BadRequestException('A skill can have at most 20 files');
        await this.prisma.file.update({ where: { id: fileId }, data: { skill_id: id } });
        await this.prisma.skillFile.upsert({ where: { skill_id_file_id: { skill_id: id, file_id: fileId } }, create: { skill_id: id, file_id: fileId }, update: {} });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'skill.file_added', target_type: 'skill', target_id: id, metadata: { filename: file.filename } });
        return this.get(actor, id);
    }

    async removeFile(actor: Actor, id: string, fileId: string) {
        await this.requireRole(actor, id, 'EDITOR');
        const link = await this.prisma.skillFile.findUnique({ where: { skill_id_file_id: { skill_id: id, file_id: fileId } } });
        if (!link) throw new NotFoundException('File not found');
        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.skillFile.delete({ where: { skill_id_file_id: { skill_id: id, file_id: fileId } } }),
            this.prisma.file.update({ where: { id: fileId }, data: { deleted_at: now, purge_after: new Date(now.getTime() + RESTORE_WINDOW_MS) } }),
        ]);
        return this.get(actor, id);
    }

    async restore(actor: Actor, id: string) {
        const { skill } = await this.requireRole(actor, id, 'OWNER', true);
        if (!skill.deleted_at) return this.get(actor, id);
        if (Date.now() - skill.deleted_at.getTime() > RESTORE_WINDOW_MS) throw new BadRequestException('This skill can no longer be restored');
        await this.prisma.skill.update({ where: { id }, data: { deleted_at: null } });
        return this.get(actor, id);
    }

    async share(actor: Actor, id: string, dto: ShareSkillDto) {
        await this.requireRole(actor, id, 'OWNER');
        if (dto.sharing_level === 'ORGANIZATION' && !isAdminRole(actor.role)) throw new ForbiddenException('Only Owners and Admins can share a skill with the whole organisation');
        const shares = dto.shares ?? [];
        if (shares.length) {
            const n = await this.prisma.organizationMember.count({ where: { organization_id: actor.organization_id, user_id: { in: shares.map((s) => s.user_id) } } });
            if (n !== new Set(shares.map((s) => s.user_id)).size) throw new BadRequestException('You can only share with organisation members');
        }
        const before = await this.prisma.skillShare.findMany({ where: { skill_id: id } });
        await this.prisma.$transaction([
            this.prisma.skill.update({ where: { id }, data: { sharing_level: dto.sharing_level } }),
            this.prisma.skillShare.deleteMany({ where: { skill_id: id } }),
            this.prisma.skillShare.createMany({ data: shares.filter((s) => s.user_id !== actor.user_id).map((s) => ({ skill_id: id, user_id: s.user_id, role: s.role })) }),
        ]);
        const added = shares.filter((s) => !before.some((b) => b.user_id === s.user_id)).map((s) => s.user_id);
        const skill = await this.prisma.skill.findUniqueOrThrow({ where: { id } });
        if (added.length) {
            await this.notifications.notifyMany(added, { organization_id: actor.organization_id, event: 'SKILL_SHARED', title: `A skill was shared with you: ${skill.emoji ?? ''} ${skill.name}`.trim(), link_path: `/skills/${id}` });
        }
        return this.get(actor, id);
    }

    /** Assign or remove a skill on a bot (§6.7). The user must be able to use the skill and edit the bot. */
    async assign(actor: Actor, skillId: string, botId: string, assign: boolean) {
        await this.requireRole(actor, skillId, 'USER');
        await this.access.requireEditableBot(actor.organization_id, actor.user_id, botId);
        if (assign) await this.prisma.botSkill.upsert({ where: { bot_id_skill_id: { bot_id: botId, skill_id: skillId } }, create: { bot_id: botId, skill_id: skillId }, update: {} });
        else await this.prisma.botSkill.deleteMany({ where: { bot_id: botId, skill_id: skillId } });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: assign ? 'skill.assigned' : 'skill.unassigned', target_type: 'bot', target_id: botId, metadata: { skill_id: skillId } });
        return { ok: true };
    }

    async setBots(actor: Actor, skillId: string, botIds: string[]) {
        await this.requireRole(actor, skillId, 'USER');
        const current = await this.prisma.botSkill.findMany({ where: { skill_id: skillId, bot: { organization_id: actor.organization_id } } });
        for (const id of botIds.filter((b) => !current.some((c) => c.bot_id === b))) await this.assign(actor, skillId, id, true);
        for (const c of current.filter((c) => !botIds.includes(c.bot_id))) await this.assign(actor, skillId, c.bot_id, false).catch(() => undefined);
        return this.get(actor, skillId);
    }

    async setBotSkills(actor: Actor, botId: string, skillIds: string[]) {
        await this.access.requireEditableBot(actor.organization_id, actor.user_id, botId);
        for (const id of skillIds) await this.requireRole(actor, id, 'USER');
        await this.prisma.$transaction([
            this.prisma.botSkill.deleteMany({ where: { bot_id: botId } }),
            this.prisma.botSkill.createMany({ data: [...new Set(skillIds)].map((skill_id) => ({ bot_id: botId, skill_id })) }),
        ]);
        return { ok: true };
    }

    /** "Users can add and adjust" starter skills — adds an editable copy to the organisation. */
    async addStarter(actor: Actor, id: string) {
        const s = await this.prisma.skill.findFirst({ where: { id, is_starter: true } });
        if (!s) throw new NotFoundException('Starter skill not found');
        return this.create(actor, {
            name: s.name,
            emoji: s.emoji ?? undefined,
            slug: s.slug,
            description: s.description,
            instructions: s.instructions,
            questions: s.questions as any,
            required_services: ((s.required_tools as any[]) ?? []).map((t) => t.service_key),
            result: s.result ?? undefined,
            imported_from: `starter:${s.starter_key}`,
        });
    }

    /** Export never includes secrets (skills hold none). */
    async export(actor: Actor, id: string) {
        const s = await this.get(actor, id);
        return {
            format: 'agentspace.skill',
            version: 1,
            skill: { name: s.name, emoji: s.emoji, slug: s.slug, description: s.description, instructions: s.instructions, questions: s.questions, required_tools: s.required_tools, result: s.result },
        };
    }

    async import(actor: Actor, payload: Record<string, any>) {
        const settings = await this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } });
        if (settings && !settings.skill_import_enabled) throw new ForbiddenException('Importing skills is turned off for this organisation');
        const s = payload?.skill ?? payload;
        if (!s?.name || !s?.instructions || !s?.description) throw new BadRequestException('This is not a valid skill file');
        return this.create(actor, {
            name: String(s.name).slice(0, 80),
            emoji: s.emoji ? String(s.emoji).slice(0, 16) : undefined,
            slug: s.slug ? String(s.slug) : undefined,
            description: String(s.description).slice(0, 1000),
            instructions: String(s.instructions).slice(0, 20000),
            questions: Array.isArray(s.questions) ? s.questions.slice(0, 20) : [],
            required_services: Array.isArray(s.required_tools) ? s.required_tools.map((t: any) => String(t.service_key ?? t)).slice(0, 20) : [],
            result: s.result ? String(s.result).slice(0, 300) : undefined,
            imported_from: 'file',
        });
    }

    private async notifyChange(actor: Actor, skill: Skill, title: string) {
        const shares = await this.prisma.skillShare.findMany({ where: { skill_id: skill.id } });
        const recipients = [skill.owner_id, ...shares.map((s) => s.user_id)].filter((u): u is string => !!u && u !== actor.user_id);
        if (recipients.length) await this.notifications.notifyMany(recipients, { organization_id: actor.organization_id, event: 'SKILL_CHANGED', title, link_path: `/skills/${skill.id}` });
    }
}
