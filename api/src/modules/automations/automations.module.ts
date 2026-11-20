import { Module } from '@nestjs/common';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { AutomationTriggersService } from './automation-triggers.service';
import { AutomationWebhooksController } from './automation-webhooks.controller';
import { MeetingAssistantController } from './meeting-assistant.controller';
import { MeetingAssistantService } from './meeting-assistant.service';

/** Automations (§10.2–10.5). Conversations, runs, usage and notifications come from global modules. */
@Module({
    controllers: [AutomationsController, AutomationWebhooksController, MeetingAssistantController],
    providers: [AutomationsService, AutomationTriggersService, MeetingAssistantService],
    exports: [AutomationsService, AutomationTriggersService],
})
export class AutomationsModule { }
