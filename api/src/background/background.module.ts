import { Module } from '@nestjs/common';
import { AgentModule } from '@/modules/agent/agent.module';
import { ConnectionsModule } from '@/modules/connections/connections.module';
import { AutomationsModule } from '@/modules/automations/automations.module';
import { KnowledgeModule } from '@/modules/knowledge/knowledge.module';
import { ChannelsModule } from '@/modules/channels/channels.module';
import { ComputersModule } from '@/modules/computers/computers.module';
import { ChannelsProcessor } from './channels/channels.processor';
import { AgentRunsProcessor } from './agent-runs/agent-runs.processor';
import { AutomationsProcessor } from './automations/automations.processor';
import { NotificationsProcessor } from './notifications/notifications.processor';
import { KnowledgeProcessor } from './knowledge/knowledge.processor';
import { ApprovalsProcessor, CloudComputersProcessor, ConnectionsProcessor, PlatformSchedules, StorageProcessor, UsageProcessor } from './maintenance/maintenance.processors';

/** Queue processors (§14.4). Loaded only when PROCESS_ROLE is `worker` or `all`. */
@Module({
    imports: [AgentModule, ConnectionsModule, AutomationsModule, KnowledgeModule, ChannelsModule, ComputersModule],
    providers: [ChannelsProcessor, AgentRunsProcessor, AutomationsProcessor, NotificationsProcessor, KnowledgeProcessor, ApprovalsProcessor, UsageProcessor, ConnectionsProcessor, CloudComputersProcessor, StorageProcessor, PlatformSchedules],
})
export class BackgroundModule { }
