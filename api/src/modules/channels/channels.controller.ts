import { Body, Controller, Delete, Get, HttpCode, Param, ParseEnumPipe, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsUUID } from 'class-validator';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ExternalChannel } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import { ChannelTransportService } from './channel-transport.service';
import { ChannelsService } from './channels.service';

export class UpsertChannelDto {
    @ApiProperty({ description: 'The bot this channel talks to' }) @IsUUID() bot_id: string;
}

const actor = (m: OrgMembership) => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });
const channelPipe = new ParseEnumPipe(ExternalChannel);

/** Settings → Message from anywhere (§16): the member's own email / Slack / WhatsApp links. */
@ApiTags('channels')
@Controller('channels')
@UseGuards(JwtGuard, OrgGuard)
export class ChannelsController {
    constructor(private readonly channels: ChannelsService) { }

    @Get()
    @ApiOperation({ summary: 'Which channels are set up, and my links' })
    list(@CurrentMembership() m: OrgMembership) {
        return this.channels.list(actor(m));
    }

    @Put(':channel')
    @ApiOperation({ summary: 'Turn a channel on, or change its bot' })
    upsert(@CurrentMembership() m: OrgMembership, @Param('channel', channelPipe) channel: ExternalChannel, @Body() dto: UpsertChannelDto) {
        return this.channels.upsert(actor(m), channel, dto.bot_id);
    }

    @Post(':channel/code')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @ApiOperation({ summary: 'New linking code (Slack, WhatsApp)' })
    code(@CurrentMembership() m: OrgMembership, @Param('channel', channelPipe) channel: ExternalChannel) {
        return this.channels.newLinkCode(actor(m), channel);
    }

    @Post('EMAIL/address')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @ApiOperation({ summary: 'New personal email address (the old one stops working)' })
    address(@CurrentMembership() m: OrgMembership) {
        return this.channels.newAddress(actor(m));
    }

    @Delete(':channel')
    @ApiOperation({ summary: 'Turn a channel off' })
    remove(@CurrentMembership() m: OrgMembership, @Param('channel', channelPipe) channel: ExternalChannel) {
        return this.channels.remove(actor(m), channel);
    }
}

/**
 * Provider webhooks (§16). Public, but every delivery must carry a valid signature; repeats are ignored. They only
 * queue the message so the provider gets its answer within a few seconds.
 */
@Controller('webhooks/channels')
export class ChannelWebhooksController {
    constructor(
        private readonly channels: ChannelsService,
        private readonly transport: ChannelTransportService,
    ) { }

    @Post('email')
    @HttpCode(200)
    @ApiExcludeEndpoint()
    @Throttle({ default: { limit: 600, ttl: 60_000 } })
    async email(@Req() req: RawBodyRequest<Request>) {
        const e = this.transport.verifyEmail(req.headers, req.rawBody);
        if (!e) return { ok: true, ignored: true };
        const domain = this.transport.inboundDomain;
        const to = e.to.find((a) => a.endsWith(`@${domain}`));
        if (!to) return { ok: true, ignored: true };
        const content = await this.transport.fetchEmail(e.email_id);
        // Refuse mail that failed the sender checks (spoofed "From").
        if ([content.spf, content.dkim, content.dmarc].some((v) => v === 'fail')) return { ok: true, ignored: true };
        if (!content.text.trim()) return { ok: true, ignored: true };
        const queued = await this.channels.enqueueInbound({
            channel: ExternalChannel.EMAIL,
            delivery_id: e.delivery_id,
            external_id: to.split('@')[0],
            from_address: e.from,
            text: e.subject && !/^re:/i.test(e.subject) ? `${e.subject}\n\n${content.text}` : content.text,
            meta: { email_message_id: e.message_id, email_subject: e.subject },
        });
        return { ok: true, queued };
    }

    @Post('slack')
    @HttpCode(200)
    @ApiExcludeEndpoint()
    @Throttle({ default: { limit: 600, ttl: 60_000 } })
    async slack(@Req() req: RawBodyRequest<Request>) {
        const r = this.transport.verifySlack(req.headers, req.rawBody);
        if (r.challenge) return { challenge: r.challenge };
        if (r.message) await this.channels.enqueueInbound(r.message);
        return { ok: true };
    }

    @Get('whatsapp')
    @ApiExcludeEndpoint()
    whatsappVerify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string, @Res() res: Response) {
        res.type('text/plain').send(this.transport.verifyWhatsAppSubscription(mode, token, challenge));
    }

    @Post('whatsapp')
    @HttpCode(200)
    @ApiExcludeEndpoint()
    @Throttle({ default: { limit: 600, ttl: 60_000 } })
    async whatsapp(@Req() req: RawBodyRequest<Request>) {
        const r = this.transport.verifyWhatsApp(req.headers, req.rawBody);
        for (const m of r.messages) await this.channels.enqueueInbound(m);
        for (const to of r.unsupported) await this.transport.notice(ExternalChannel.WHATSAPP, { whatsapp_to: to }, 'Only text messages are supported here for now. Send pictures and files in the Agent Space app.');
        return { ok: true };
    }
}
