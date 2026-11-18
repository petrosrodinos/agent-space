import { Module } from '@nestjs/common';
import { BotsModule } from '../bots/bots.module';
import { UsersModule } from '../users/users.module';
import { ConnectionsModule } from '../connections/connections.module';
import { SkillsModule } from '../skills/skills.module';
import { AgentRunnerService } from './agent-runner.service';
import { PromptBuilder } from './prompt.builder';
import { BuiltinToolsService } from './tools/builtin-tools.service';
import { ConnectionToolsService } from './tools/connection-tools.service';
import { AutomationsModule } from '../automations/automations.module';
import { AutomationToolsService } from './tools/automation-tools.service';
import { ArtifactsModule } from '../artifacts/artifacts.module';
import { ArtifactToolsService } from './tools/artifact-tools.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { KnowledgeToolsService } from './tools/knowledge-tools.service';
import { ComputersModule } from '../computers/computers.module';
import { ComputerToolsService } from './tools/computer-tools.service';
import { McpToolsService } from './tools/mcp-tools.service';

/** The tool layer and run loop (used by the agent-runs worker). */
@Module({
    imports: [BotsModule, UsersModule, ConnectionsModule, SkillsModule, AutomationsModule, ArtifactsModule, KnowledgeModule, ComputersModule],
    providers: [AgentRunnerService, PromptBuilder, BuiltinToolsService, ConnectionToolsService, AutomationToolsService, ArtifactToolsService, KnowledgeToolsService, ComputerToolsService, McpToolsService],
    exports: [AgentRunnerService, PromptBuilder],
})
export class AgentModule { }
