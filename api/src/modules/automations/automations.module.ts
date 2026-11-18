import { Module } from '@nestjs/common';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';

/** Automations (§10.2–10.5). Conversations, runs, usage and notifications come from global modules. */
@Module({
    controllers: [AutomationsController],
    providers: [AutomationsService],
    exports: [AutomationsService],
})
export class AutomationsModule { }
