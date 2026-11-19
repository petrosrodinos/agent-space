import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards, type PipeTransform } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import type { Actor } from '../bots/bots.service';
import { RunsService } from '../runs/runs.service';
import { ConnectionsService } from './connections.service';
import { CredentialsService } from './credentials.service';
import {
    CancelSecretRequestDto, CatalogQuery, CatalogQuerySchema, ConnectComposioDto, CreateApiKeyConnectionDto, CreateCredentialDto, CredentialQuery,
    CredentialQuerySchema, ReplaceCredentialDto, SetServiceDefaultDto, SetToolPermissionsDto, UpdateConnectionDto, UpdateCredentialDto,
} from './dto/connection.dto';

/** Composio toolkit slugs: lowercase letters, digits, underscores and dashes. */
class ParseSlugPipe implements PipeTransform<string, string> {
    transform(value: string) {
        if (!/^[a-z0-9_-]{1,80}$/.test(value ?? '')) throw new BadRequestException('Invalid service');
        return value;
    }
}

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

@ApiTags('Connections')
@ApiBearerAuth()
@Controller('connections')
@UseGuards(JwtGuard, OrgGuard)
export class ConnectionsController {
    constructor(private readonly connections: ConnectionsService) { }

    @Get()
    list(@CurrentMembership() m: OrgMembership) {
        return this.connections.list(actor(m));
    }

    @Get('catalog')
    @ApiOperation({ summary: 'Supported services with search and categories (§8.1)' })
    catalog(@CurrentMembership() m: OrgMembership, @Query(new ZodValidationPipe(CatalogQuerySchema)) q: CatalogQuery) {
        return this.connections.catalog(actor(m), q);
    }

    @Get('categories')
    categories() {
        return this.connections.categories();
    }

    @Get('services/:slug')
    @ApiOperation({ summary: 'Service details: description, every tool (reads/writes) and your permission for each' })
    service(@CurrentMembership() m: OrgMembership, @Param('slug', new ParseSlugPipe()) slug: string) {
        return this.connections.serviceDetails(actor(m), slug);
    }

    @Put('services/:slug/permissions')
    @ApiOperation({ summary: 'Set your permission for one or more tools of a service' })
    setPermissions(@CurrentMembership() m: OrgMembership, @Param('slug', new ParseSlugPipe()) slug: string, @Body() dto: SetToolPermissionsDto) {
        return this.connections.setToolPermissions(actor(m), slug, dto);
    }

    @Post('composio')
    @ApiOperation({ summary: 'Start connecting an account; returns the service sign-in URL' })
    connect(@CurrentMembership() m: OrgMembership, @Body() dto: ConnectComposioDto) {
        return this.connections.connectComposio(actor(m), dto);
    }

    @Post('api-key')
    @ApiOperation({ summary: 'Add a service by pasting an access key (§8.5)' })
    apiKey(@CurrentMembership() m: OrgMembership, @Body() dto: CreateApiKeyConnectionDto) {
        return this.connections.createApiKey(actor(m), dto);
    }

    @Put('defaults')
    setDefault(@CurrentMembership() m: OrgMembership, @Body() dto: SetServiceDefaultDto) {
        return this.connections.setDefault(actor(m), dto.service_key, dto.connection_id);
    }

    @Post(':id/complete')
    complete(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.connections.complete(actor(m), id);
    }

    @Post(':id/reconnect')
    reconnect(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body('return_url') returnUrl?: string) {
        return this.connections.reconnect(actor(m), id, returnUrl);
    }

    @Patch(':id')
    update(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateConnectionDto) {
        return this.connections.update(actor(m), id, dto);
    }

    @Delete(':id')
    remove(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.connections.remove(actor(m), id);
    }
}

/** §8.9 Secrets page. Request bodies of these endpoints are never logged. */
@ApiTags('Secrets')
@ApiBearerAuth()
@Controller('credentials')
@UseGuards(JwtGuard, OrgGuard)
export class CredentialsController {
    constructor(
        private readonly credentials: CredentialsService,
        private readonly runs: RunsService,
    ) { }

    @Get()
    list(@CurrentMembership() m: OrgMembership, @Query(new ZodValidationPipe(CredentialQuerySchema)) q: CredentialQuery) {
        return this.credentials.list(actor(m), q);
    }

    @Post()
    @Throttle({ default: { limit: 20, ttl: 60_000 } })
    @ApiOperation({ summary: 'Save a secret (secure secret box or Secrets page). Returns metadata only.' })
    async create(@CurrentMembership() m: OrgMembership, @Body() dto: CreateCredentialDto) {
        const cred = await this.credentials.create(actor(m), dto);
        if (dto.request) {
            await this.runs.provideInput(actor(m), dto.request.run_id, dto.request.request_id, {
                status: 'saved',
                credential_id: cred.id,
                label: cred.label,
                service: cred.service_name,
                masked_hint: cred.masked_hint,
            });
        }
        return cred;
    }

    @Post('cancel-request')
    cancel(@CurrentMembership() m: OrgMembership, @Body() dto: CancelSecretRequestDto) {
        return this.runs.provideInput(actor(m), dto.request.run_id, dto.request.request_id, { status: 'cancelled' });
    }

    @Get(':id')
    get(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.credentials.get(actor(m), id);
    }

    @Patch(':id')
    update(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCredentialDto) {
        return this.credentials.updateMeta(actor(m), id, dto);
    }

    @Post(':id/replace')
    @Throttle({ default: { limit: 20, ttl: 60_000 } })
    async replace(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplaceCredentialDto) {
        const cred = await this.credentials.replace(actor(m), id, dto.value, { username: dto.username, totp_secret: dto.totp_secret });
        if (dto.request) {
            await this.runs.provideInput(actor(m), dto.request.run_id, dto.request.request_id, { status: 'saved', credential_id: cred.id, label: cred.label, service: cred.service_name, masked_hint: cred.masked_hint });
        }
        return cred;
    }

    @Get(':id/usage')
    usage(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.credentials.usage(actor(m), id);
    }

    @Get(':id/history')
    history(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.credentials.history(actor(m), id);
    }

    @Delete(':id')
    remove(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.credentials.remove(actor(m), id);
    }
}
