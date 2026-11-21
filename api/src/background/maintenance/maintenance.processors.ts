import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { Jobs, PLATFORM_SCHEDULES, Queues } from '@/core/queues/queues.constants';
import { StorageService } from '@/integrations/storage/storage.service';
import { ApprovalsService } from '@/modules/approvals/approvals.service';
import { ConnectionsService } from '@/modules/connections/connections.service';
import { ToolServersService } from '@/modules/connections/mcp/tool-servers.service';
import { UsageService } from '@/modules/usage/usage.service';
import { ComputersService } from '@/modules/computers/computers.service';

@Processor(Queues.APPROVALS, { concurrency: 10 })
export class ApprovalsProcessor extends WorkerHost {
    constructor(private readonly approvals: ApprovalsService) {
        super();
    }

    async process(job: Job<{ approval_id: string; auto_approve?: boolean }>) {
        if (job.name === Jobs.approvals.TIMEOUT) await this.approvals.expire(job.data.approval_id, !!job.data.auto_approve);
    }
}

/** cloud-computers queue (§9): the safety net that keeps VMs from running (and billing) when they shouldn't. One sweep at a time. */
@Processor(Queues.CLOUD_COMPUTERS, { concurrency: 1 })
export class CloudComputersProcessor extends WorkerHost {
    constructor(private readonly computers: ComputersService) {
        super();
    }

    async process(job: Job) {
        if (job.name === Jobs.cloudComputers.SWEEP) return this.computers.sweep();
        return { ok: true };
    }
}

@Processor(Queues.USAGE, { concurrency: 2 })
export class UsageProcessor extends WorkerHost {
    constructor(private readonly usage: UsageService) {
        super();
    }

    async process(job: Job) {
        if (job.name === Jobs.usage.FLUSH_COUNTERS) return this.usage.flush();
        if (job.name === Jobs.usage.LIMIT_ALERTS) return this.usage.limitAlerts();
        return { ok: true };
    }
}

@Processor(Queues.CONNECTIONS, { concurrency: 10 })
export class ConnectionsProcessor extends WorkerHost {
    constructor(
        private readonly connections: ConnectionsService,
        private readonly toolServers: ToolServersService,
    ) {
        super();
    }

    async process(job: Job<{ organization_id?: string; user_id?: string }>) {
        if (job.name === Jobs.connections.SYNC_COMPOSIO_STATUS) return this.connections.syncComposioStatuses();
        if (job.name === Jobs.connections.REFRESH_TOKEN) return this.toolServers.refreshExpiringSignIns();
        if (job.name === Jobs.connections.REVOKE_AND_DELETE) return this.connections.revokeAndDeleteForMember(job.data.organization_id!, job.data.user_id!);
    }
}

const ARTIFACT_PURGE_AFTER_MS = 30 * 86400_000;

/** storage queue (§7.7): permanently delete objects 30 days after soft deletion; apply retention. */
@Processor(Queues.STORAGE, { concurrency: 2 })
export class StorageProcessor extends WorkerHost {
    private readonly logger = new Logger(StorageProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
    ) {
        super();
    }

    async process(job: Job) {
        if (job.name === Jobs.storage.PURGE_DELETED) {
            const files = await this.prisma.file.findMany({ where: { deleted_at: { not: null }, purge_after: { lt: new Date() } }, take: 1000 });
            for (const f of files) {
                await this.storage.remove(f.bucket, f.object_path).catch((e) => this.logger.warn(e.message));
                await this.prisma.file.delete({ where: { id: f.id } }).catch(() => undefined);
            }
            // §7.5: deleted artifacts are only removed for good when their owner turned on the 30-day setting.
            const artifacts = await this.prisma.artifact.findMany({
                where: { deleted_at: { lt: new Date(Date.now() - ARTIFACT_PURGE_AFTER_MS) }, owner: { settings: { purge_deleted_artifacts: true } } },
                select: { id: true, files: { select: { bucket: true, object_path: true } } },
                take: 200,
            });
            for (const a of artifacts) {
                for (const f of a.files) await this.storage.remove(f.bucket, f.object_path).catch((e) => this.logger.warn(e.message));
                await this.prisma.artifact.delete({ where: { id: a.id } }).catch((e) => this.logger.warn(`Artifact purge ${a.id}: ${e.message}`));
            }
            return { purged: files.length, artifacts: artifacts.length };
        }
        if (job.name === Jobs.storage.APPLY_RETENTION) {
            const orgs = await this.prisma.organizationSettings.findMany({ where: { conversation_retention: { not: 'FOREVER' } } });
            let n = 0;
            for (const s of orgs) {
                const days = { YEAR_1: 365, DAYS_90: 90, DAYS_30: 30, FOREVER: 0 }[s.conversation_retention];
                const cutoff = new Date(Date.now() - days * 86400_000);
                const res = await this.prisma.message.updateMany({ where: { organization_id: s.organization_id, created_at: { lt: cutoff }, deleted_at: null }, data: { deleted_at: new Date(), content: null } });
                n += res.count;
            }
            return { messages: n };
        }
        return { ok: true };
    }
}

/** Platform schedulers are upserted at worker start-up from a single list (§14.4) — runs once across instances. */
@Injectable()
export class PlatformSchedules implements OnApplicationBootstrap {
    private readonly logger = new Logger(PlatformSchedules.name);

    constructor(
        @InjectQueue(Queues.STORAGE) private readonly storageQ: Queue,
        @InjectQueue(Queues.AUTOMATIONS) private readonly automationsQ: Queue,
        @InjectQueue(Queues.CONNECTIONS) private readonly connectionsQ: Queue,
        @InjectQueue(Queues.USAGE) private readonly usageQ: Queue,
        @InjectQueue(Queues.CLOUD_COMPUTERS) private readonly cloudQ: Queue,
    ) { }

    async onApplicationBootstrap() {
        const byName: Record<string, Queue> = { [Queues.STORAGE]: this.storageQ, [Queues.AUTOMATIONS]: this.automationsQ, [Queues.CONNECTIONS]: this.connectionsQ, [Queues.USAGE]: this.usageQ, [Queues.CLOUD_COMPUTERS]: this.cloudQ };
        for (const s of PLATFORM_SCHEDULES) {
            const q = byName[s.queue];
            if (!q) continue;
            await q.upsertJobScheduler(`platform:${s.job}`, s.pattern ? { pattern: s.pattern, tz: 'UTC' } : { every: s.every! }, { name: s.job, data: {} }).catch((e) => this.logger.warn(`Scheduler ${s.job}: ${e.message}`));
        }
        this.logger.log(`Platform schedules upserted (${PLATFORM_SCHEDULES.length})`);
    }
}
