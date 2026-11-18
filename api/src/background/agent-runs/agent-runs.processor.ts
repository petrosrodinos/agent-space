import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { DelayedError, Job } from 'bullmq';
import { Queues } from '@/core/queues/queues.constants';
import { AgentRunnerService, LockBusyError } from '@/modules/agent/agent-runner.service';

/**
 * agent-runs queue (§14.4). Chat replies and tasks are never retried automatically (a retry could repeat actions);
 * if the conversation/bot lock is held, the job is moved back to delayed for 2 seconds so replies stay in order.
 */
@Processor(Queues.AGENT_RUNS, { concurrency: 20, lockDuration: 60_000, stalledInterval: 30_000 })
export class AgentRunsProcessor extends WorkerHost {
    private readonly logger = new Logger(AgentRunsProcessor.name);

    constructor(private readonly runner: AgentRunnerService) {
        super();
    }

    async process(job: Job<{ run_id: string }>, token?: string) {
        const runId = job.data.run_id;
        try {
            await this.runner.execute(runId);
        } catch (e) {
            if (e instanceof LockBusyError && token) {
                await job.moveToDelayed(Date.now() + 2000, token);
                throw new DelayedError();
            }
            this.logger.error(`run ${runId} crashed: ${(e as Error).stack ?? e}`);
            await this.runner.markCrashed(runId, 'Something went wrong while working on this. Please try again.');
        }
    }
}
