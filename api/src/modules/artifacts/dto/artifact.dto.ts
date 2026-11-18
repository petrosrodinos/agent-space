import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { z } from 'zod';

export const ARTIFACT_TYPES = ['WEB_APP', 'DASHBOARD', 'PAGE', 'DOCUMENT', 'PRESENTATION', 'DIAGRAM', 'FORM', 'TOOL', 'GAME', 'OTHER'] as const;
export const ARTIFACT_ROLES = ['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER'] as const;
export const ARTIFACT_SHARING = ['PRIVATE', 'SPECIFIC_MEMBERS', 'ORGANIZATION', 'PUBLIC_LINK'] as const;
export type ArtifactRoleName = (typeof ARTIFACT_ROLES)[number];

export const MAX_ARTIFACT_HTML = 600_000;

export const ArtifactQuerySchema = z.object({
    tab: z.enum(['all', 'mine', 'shared', 'organization', 'deleted']).default('all'),
    search: z.string().trim().max(80).optional(),
    type: z.enum(ARTIFACT_TYPES).optional(),
    conversation_id: z.string().uuid().optional(),
});
export type ArtifactQuery = z.infer<typeof ArtifactQuerySchema>;

export class UpdateArtifactDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
    @ApiPropertyOptional({ enum: ARTIFACT_TYPES }) @IsOptional() @IsIn(ARTIFACT_TYPES) type?: (typeof ARTIFACT_TYPES)[number];
    @ApiPropertyOptional({ example: 'q4-webinar' })
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(60)
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Use lowercase letters, numbers and dashes' })
    slug?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() review_before_publish?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() pinned?: boolean;
}

class ArtifactShareDto {
    @ApiProperty() @IsUUID() user_id: string;
    @ApiProperty({ enum: ['EDITOR', 'COMMENTER', 'VIEWER'] }) @IsIn(['EDITOR', 'COMMENTER', 'VIEWER']) role: 'EDITOR' | 'COMMENTER' | 'VIEWER';
}

export class ShareArtifactDto {
    @ApiProperty({ enum: ARTIFACT_SHARING }) @IsIn(ARTIFACT_SHARING) sharing_level: (typeof ARTIFACT_SHARING)[number];
    @ApiPropertyOptional({ type: [ArtifactShareDto] }) @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ArtifactShareDto) shares?: ArtifactShareDto[];
    @ApiPropertyOptional({ enum: ['EDITOR', 'COMMENTER', 'VIEWER'], description: 'Role everyone in the organisation gets (Organisation / Public link levels)' })
    @IsOptional()
    @IsIn(['EDITOR', 'COMMENTER', 'VIEWER'])
    organization_role?: 'EDITOR' | 'COMMENTER' | 'VIEWER';
}

export class PublicLinkDto {
    @ApiProperty() @IsBoolean() enabled: boolean;
    @ApiPropertyOptional({ description: 'New password; empty string removes it' }) @IsOptional() @IsString() @MaxLength(120) password?: string;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_o, v) => v !== null) @IsDateString() expires_at?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() allow_search_engines?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() allow_embedding?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() public_ai_enabled?: boolean;
}

export class TransferArtifactDto {
    @ApiProperty() @IsUUID() user_id: string;
}

export class LabelVersionDto {
    @ApiProperty({ nullable: true }) @IsOptional() @IsString() @MaxLength(80) label: string | null;
}

export class ViewTokenDto {
    @ApiPropertyOptional({ description: 'Preview a specific version (editors only)' }) @IsOptional() @IsUUID() version_id?: string;
}

export class CreateCommentDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(4000) content: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() parent_comment_id?: string;
    @ApiPropertyOptional({ description: 'Bot to ask to act on this comment (it edits the artifact)' }) @IsOptional() @IsUUID() mentioned_bot_id?: string;
    @ApiPropertyOptional({ description: 'Where in the artifact: { section?: string, text?: string }' }) @IsOptional() anchor?: Record<string, unknown>;
}

export class ResolveCommentDto {
    @ApiProperty() @IsBoolean() resolved: boolean;
}

export class ReportArtifactDto {
    @ApiProperty() @IsString() @MinLength(3) @MaxLength(2000) reason: string;
    @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
}

export class UnlockArtifactDto {
    @ApiProperty() @IsString() @MaxLength(120) password: string;
}
