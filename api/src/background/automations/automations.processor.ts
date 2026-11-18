import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Jobs, Queues } from '@/core/queues/queues.constants';
import { AutomationsService } from '@/modules/automations/automations.service';

interface AutomationJob {
    automation_id?: string;
    retry_of?: string;
}

/**
 * automations queue (§10.6, §14.4): `tick` (from each automation's job scheduler), `retry` (10 minutes after a failed run)
 * and the nightly `reconcile-schedulers`.
 */
@Processor(Queues.AUTOMATIONS, { concurrency: 10 })
export class AutomationsProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly logger = new Logger(AutomationsProcessor.name);

    constructor(private readonly automations: AutomationsService) {
        super();
    }

    async onApplicationBootstrap() {
        // Make sure schedulers match the database after deploys or Redis restarts.
        const res = await this.automations.reconcile().catch((e) => this.logger.warn(`Reconcile failed: ${(e as Error).message}`));
        if (res) this.logger.log(`Automation schedulers reconciled (${res.active} active, ${res.removed} removed)`);
    }

    async process(job: Job<AutomationJob>) {
        switch (job.name) {
            case Jobs.automations.TICK:
                return this.automations.tick(job.data.automation_id!, { scheduled_for: job.timestamp ? new Date(job.timestamp) : null });
            case Jobs.automations.RETRY:
                return this.automations.tick(job.data.automation_id!, { retry_of: job.data.retry_of });
            case Jobs.automations.RECONCILE:
                return this.automations.reconcile();
            default:
                return { ignored: job.name };
        }
    }
}
