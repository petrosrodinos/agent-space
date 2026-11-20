import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { WidgetsController } from './widgets.controller';
import { WidgetsService } from './widgets.service';

@Module({
    imports: [AgentModule],
    controllers: [WidgetsController],
    providers: [WidgetsService],
})
export class WidgetsModule { }
