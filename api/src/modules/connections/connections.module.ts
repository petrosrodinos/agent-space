import { Module } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { CredentialsService } from './credentials.service';
import { ConnectionsController, CredentialsController } from './connections.controller';
import { ToolServersService } from './mcp/tool-servers.service';
import { ToolServersController } from './mcp/tool-servers.controller';

@Module({
    controllers: [ConnectionsController, CredentialsController, ToolServersController],
    providers: [ConnectionsService, CredentialsService, ToolServersService],
    exports: [ConnectionsService, CredentialsService, ToolServersService],
})
export class ConnectionsModule { }
