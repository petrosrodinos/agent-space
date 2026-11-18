import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import type { Actor } from '../bots/bots.service';
import { ArtifactsService } from './artifacts.service';
import {
    ArtifactQuery,
    ArtifactQuerySchema,
    CreateCommentDto,
    LabelVersionDto,
    PublicLinkDto,
    ResolveCommentDto,
    ShareArtifactDto,
    TransferArtifactDto,
    UpdateArtifactDto,
    ViewTokenDto,
} from './dto/artifact.dto';

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

@ApiTags('Artifacts')
@ApiBearerAuth()
@Controller('artifacts')
@UseGuards(JwtGuard, OrgGuard)
export class ArtifactsController {
    constructor(private readonly artifacts: ArtifactsService) { }

    @Get()
    list(@CurrentMembership() m: OrgMembership, @Query(new ZodValidationPipe(ArtifactQuerySchema)) q: ArtifactQuery) {
        return this.artifacts.list(actor(m), q);
    }

    @Get('public-links')
    publicLinks(@CurrentMembership() m: OrgMembership) {
        return this.artifacts.publicLinks(actor(m));
    }

    @Get(':id')
    get(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.artifacts.get(actor(m), id);
    }

    @Patch(':id')
    update(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateArtifactDto) {
        return this.artifacts.update(actor(m), id, dto);
    }

    @Delete(':id')
    remove(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.artifacts.remove(actor(m), id);
    }

    @Post(':id/restore')
    restore(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.artifacts.restore(actor(m), id);
    }

    @Post(':id/duplicate')
    duplicate(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.artifacts.duplicate(actor(m), id);
    }

    @Put(':id/sharing')
    share(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ShareArtifactDto) {
        return this.artifacts.share(actor(m), id, dto);
    }

    @Put(':id/public-link')
    publicLink(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PublicLinkDto) {
        return this.artifacts.publicLink(actor(m), id, dto);
    }

    @Post(':id/transfer')
    transfer(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferArtifactDto) {
        return this.artifacts.transfer(actor(m), id, dto.user_id);
    }

    @Post(':id/view-token')
    viewToken(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ViewTokenDto) {
        return this.artifacts.viewToken(actor(m), id, dto.version_id);
    }

    @Get(':id/export')
    export(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.artifacts.exportHtml(actor(m), id);
    }

    // ---- versions ----

    @Get(':id/versions')
    versions(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.artifacts.versions(actor(m), id);
    }

    @Patch(':id/versions/:versionId')
    label(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Param('versionId', ParseUUIDPipe) versionId: string, @Body() dto: LabelVersionDto) {
        return this.artifacts.labelVersion(actor(m), id, versionId, dto);
    }

    @Post(':id/versions/:versionId/restore')
    restoreVersion(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Param('versionId', ParseUUIDPipe) versionId: string) {
        return this.artifacts.restoreVersion(actor(m), id, versionId);
    }

    @Post(':id/publish')
    publish(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.artifacts.publishDraft(actor(m), id);
    }

    @Delete(':id/draft')
    discardDraft(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.artifacts.discardDraft(actor(m), id);
    }

    // ---- stored records ----

    @Get(':id/records')
    records(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Query('collection') collection?: string) {
        return this.artifacts.records(actor(m), id, collection || undefined);
    }

    @Delete(':id/records/:recordId')
    deleteRecord(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Param('recordId', ParseUUIDPipe) recordId: string) {
        return this.artifacts.deleteRecord(actor(m), id, recordId);
    }

    // ---- comments ----

    @Get(':id/comments')
    comments(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.artifacts.comments(actor(m), id);
    }

    @Post(':id/comments')
    addComment(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCommentDto) {
        return this.artifacts.addComment(actor(m), id, dto);
    }

    @Patch(':id/comments/:commentId')
    resolveComment(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Param('commentId', ParseUUIDPipe) commentId: string, @Body() dto: ResolveCommentDto) {
        return this.artifacts.resolveComment(actor(m), id, commentId, dto.resolved);
    }

    @Delete(':id/comments/:commentId')
    deleteComment(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Param('commentId', ParseUUIDPipe) commentId: string) {
        return this.artifacts.deleteComment(actor(m), id, commentId);
    }
}
