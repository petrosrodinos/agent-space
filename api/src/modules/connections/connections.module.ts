import { Module } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { CredentialsService } from './credentials.service';
import { ConnectionsController, CredentialsController } from './connections.controller';
import { McpClientService } from './mcp/mcp-client.service';
import { ToolServersService } from './mcp/tool-servers.service';
import { ToolServersController } from './mcp/tool-servers.controller';

@Module({
    controllers: [ConnectionsController, CredentialsController, ToolServersController],
    providers: [ConnectionsService, CredentialsService, McpClientService, ToolServersService],
    exports: [ConnectionsService, CredentialsService, McpClientService, ToolServersService],
})
export class ConnectionsModule { }
