import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Jobs, Queues } from '@/core/queues/queues.constants';
import { ChannelsService } from '@/modules/channels/channels.service';
import type { ChannelJob } from '@/modules/channels/channels.constants';

/** channels queue (§16 Message from anywhere): posts inbound email / Slack / WhatsApp messages and sends the bot's replies back. */
@Processor(Queues.CHANNELS, { concurrency: 10 })
export class ChannelsProcessor extends WorkerHost {
    private readonly logger = new Logger(ChannelsProcessor.name);

    constructor(private readonly channels: ChannelsService) {
        super();
    }

    async process(job: Job<ChannelJob>) {
        try {
            if (job.name === Jobs.channels.INBOUND && job.data.inbound) return await this.channels.handleInbound(job.data.inbound);
            if (job.name === Jobs.channels.REPLY && job.data.run_id && job.data.status) return await this.channels.sendReply(job.data.run_id, job.data.status);
        } catch (e) {
            this.logger.warn(`${job.name} failed (attempt ${job.attemptsMade + 1}): ${(e as Error).message}`);
            throw e;
        }
    }
}
