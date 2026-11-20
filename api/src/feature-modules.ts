import { ArtifactsModule } from './modules/artifacts/artifacts.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { BotsModule } from './modules/bots/bots.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { SkillsModule } from './modules/skills/skills.module';
import { FilesModule } from './modules/files/files.module';
import { UsageModule } from './modules/usage/usage.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { ComputersModule } from './modules/computers/computers.module';
import { VoiceModule } from './modules/voice/voice.module';
import { DesktopReleasesModule } from './modules/desktop-releases/desktop-releases.module';
import { WidgetsModule } from './modules/widgets/widgets.module';
import { AppLinksModule } from './modules/app-links/app-links.module';
import { ChannelsModule } from './modules/channels/channels.module';

/** Feature modules registered in AppModule. Kept in one list so api/worker roles share the same graph. */
export const FEATURE_MODULES = [CatalogModule, UsageModule, FilesModule, BotsModule, ConversationsModule, ConnectionsModule, SkillsModule, RealtimeModule, AutomationsModule, ArtifactsModule, KnowledgeModule, ComputersModule, VoiceModule, DesktopReleasesModule, WidgetsModule, AppLinksModule, ChannelsModule];
