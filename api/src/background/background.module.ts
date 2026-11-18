import { Module } from '@nestjs/common';
import { AgentModule } from '@/modules/agent/agent.module';
import { ConnectionsModule } from '@/modules/connections/connections.module';
import { AutomationsModule } from '@/modules/automations/automations.module';
import { AgentRunsProcessor } from './agent-runs/agent-runs.processor';
import { AutomationsProcessor } from './automations/automations.processor';
import { NotificationsProcessor } from './notifications/notifications.processor';
import { ApprovalsProcessor, ConnectionsProcessor, PlatformSchedules, StorageProcessor, UsageProcessor } from './maintenance/maintenance.processors';

/** Queue processors (§14.4). Loaded only when PROCESS_ROLE is `worker` or `all`. */
@Module({
    imports: [AgentModule, ConnectionsModule, AutomationsModule],
    providers: [AgentRunsProcessor, AutomationsProcessor,NotificationsProcessor, ApprovalsProcessor, UsageProcessor, ConnectionsProcessor, StorageProcessor, PlatformSchedules],
})
export class BackgroundModule { }
