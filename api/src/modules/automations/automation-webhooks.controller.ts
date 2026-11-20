import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { AutomationTriggersService } from './automation-triggers.service';
import { AutomationsService } from './automations.service';

/**
 * Composio calls this when a watched event happens in a connected service (§10.2). Public, but every delivery must
 * carry a valid signature (COMPOSIO_WEBHOOK_SECRET); repeats of the same delivery are ignored.
 */
@ApiExcludeController()
@Controller('webhooks')
export class AutomationWebhooksController {
    constructor(
        private readonly triggers: AutomationTriggersService,
        private readonly automations: AutomationsService,
    ) { }

    @Post('composio')
    @HttpCode(200)
    @Throttle({ default: { limit: 600, ttl: 60_000 } })
    async composio(@Req() req: RawBodyRequest<Request>) {
        const event = await this.triggers.verify(req.headers, req.rawBody);
        if (!event) return { ok: true, duplicate: true };
        const result = await this.automations.onTriggerEvent(event);
        return { ok: true, status: result.status };
    }
}
