import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { z } from 'zod';

export class ConnectComposioDto {
    @ApiProperty({ example: 'gmail' }) @IsString() @MaxLength(80) toolkit: string;
    @ApiPropertyOptional({ example: 'Gmail – Sales' }) @IsOptional() @IsString() @MaxLength(80) label?: string;
    @ApiPropertyOptional({ enum: ['PRIVATE', 'SHARED'] }) @IsOptional() @IsIn(['PRIVATE', 'SHARED']) visibility?: 'PRIVATE' | 'SHARED';
    @ApiPropertyOptional({ description: 'App route to return to (/connections/callback). Lets native apps use a deep link later (§14.1).' }) @IsOptional() @IsString() @MaxLength(500) return_url?: string;
}

export class UpdateConnectionDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(80) label?: string;
    @ApiPropertyOptional({ enum: ['PRIVATE', 'SHARED'] }) @IsOptional() @IsIn(['PRIVATE', 'SHARED']) visibility?: 'PRIVATE' | 'SHARED';
    @ApiPropertyOptional({ description: 'Limit a shared connection to these bots; empty = all bots' }) @IsOptional() @IsArray() @IsUUID('all', { each: true }) restricted_bot_ids?: string[];
}

export class CreateApiKeyConnectionDto {
    @ApiProperty({ example: 'Mailchimp' }) @IsString() @MinLength(1) @MaxLength(60) service_name: string;
    @ApiProperty({ example: 'Mailchimp – Marketing' }) @IsString() @MinLength(1) @MaxLength(80) label: string;
    @ApiProperty() @IsString() @MinLength(6) @MaxLength(8000) api_key: string;
    @ApiPropertyOptional({ enum: ['PRIVATE', 'SHARED'] }) @IsOptional() @IsIn(['PRIVATE', 'SHARED']) visibility?: 'PRIVATE' | 'SHARED';
    @ApiPropertyOptional() @IsOptional() @IsArray() @IsUUID('all', { each: true }) bot_ids?: string[];
}

export const ToolPermissions = { ALWAYS_ALLOW: 'ALWAYS_ALLOW', AUTO_REVIEW: 'AUTO_REVIEW', NEEDS_APPROVAL: 'NEEDS_APPROVAL', BLOCKED: 'BLOCKED' } as const;
export type ToolPermissionValue = (typeof ToolPermissions)[keyof typeof ToolPermissions];

/** Sets one permission on several tools of a service at once (a single tool, or a whole Reads/Writes group). */
export class SetToolPermissionsDto {
    @ApiProperty({ example: ['NOTION_CREATE_PAGE'] }) @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) @MaxLength(120, { each: true }) tool_slugs: string[];
    @ApiProperty({ enum: Object.values(ToolPermissions) }) @IsIn(Object.values(ToolPermissions)) permission: ToolPermissionValue;
}

export class SetServiceDefaultDto {
    @ApiProperty() @IsString() service_key: string;
    @ApiProperty() @IsUUID() connection_id: string;
}

class SecretRequestRefDto {
    @ApiProperty() @IsUUID() run_id: string;
    @ApiProperty() @IsString() request_id: string;
}

/** What the secure secret box / Secrets page can save. */
export const SecretInputKinds = { API_KEY: 'api_key', MCP_TOKEN: 'mcp_token', WEBSITE_LOGIN: 'website_login' } as const;
export type SecretInputKind = (typeof SecretInputKinds)[keyof typeof SecretInputKinds];
const SECRET_INPUT_KINDS = Object.values(SecretInputKinds);

/** §8.8 — the secure secret box posts here directly; the value never goes through the chat stream or the model. */
export class CreateCredentialDto {
    @ApiProperty({ example: 'Mailchimp – Marketing' }) @IsString() @MinLength(1) @MaxLength(80) label: string;
    @ApiPropertyOptional({ example: 'Mailchimp' }) @IsOptional() @IsString() @MaxLength(60) service_name?: string;
    @ApiProperty({ enum: SECRET_INPUT_KINDS }) @IsIn(SECRET_INPUT_KINDS) kind: SecretInputKind;
    /** The key or token — or, for a website login, the password. */
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(8000) value: string;
    @ApiPropertyOptional({ description: 'Website login: the site it may be typed into', example: 'portal.acme.com' }) @IsOptional() @IsString() @MaxLength(253) website?: string;
    @ApiPropertyOptional({ description: 'Website login: username or email' }) @IsOptional() @IsString() @MaxLength(320) username?: string;
    @ApiPropertyOptional({ description: 'Website login: authenticator secret (base32 or otpauth:// link) for two-step codes' }) @IsOptional() @IsString() @MaxLength(1000) totp_secret?: string;
    @ApiPropertyOptional({ enum: ['PRIVATE', 'SHARED'] }) @IsOptional() @IsIn(['PRIVATE', 'SHARED']) visibility?: 'PRIVATE' | 'SHARED';
    @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) bot_ids?: string[];
    @ApiPropertyOptional({ type: SecretRequestRefDto }) @IsOptional() @ValidateNested() @Type(() => SecretRequestRefDto) request?: SecretRequestRefDto;
}

export class UpdateCredentialDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(80) label?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) service_name?: string;
    @ApiPropertyOptional() @IsOptional() @IsArray() @IsUUID('all', { each: true }) bot_ids?: string[];
    @ApiPropertyOptional({ enum: ['PRIVATE', 'SHARED'] }) @IsOptional() @IsIn(['PRIVATE', 'SHARED']) visibility?: 'PRIVATE' | 'SHARED';
}

export class ReplaceCredentialDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(8000) value: string;
    @ApiPropertyOptional({ description: 'Website login: new username (kept when omitted)' }) @IsOptional() @IsString() @MaxLength(320) username?: string;
    @ApiPropertyOptional({ description: 'Website login: new authenticator secret; empty string removes it' }) @IsOptional() @IsString() @MaxLength(1000) totp_secret?: string;
    @ApiPropertyOptional({ type: SecretRequestRefDto }) @IsOptional() @ValidateNested() @Type(() => SecretRequestRefDto) request?: SecretRequestRefDto;
}

export class CancelSecretRequestDto {
    @ApiProperty({ type: SecretRequestRefDto }) @ValidateNested() @Type(() => SecretRequestRefDto) request: SecretRequestRefDto;
}

export const CatalogQuerySchema = z.object({
    search: z.string().trim().max(80).optional(),
    category: z.string().trim().max(80).optional(),
    cursor: z.string().max(200).optional(),
});
export type CatalogQuery = z.infer<typeof CatalogQuerySchema>;

export const CredentialQuerySchema = z.object({
    search: z.string().trim().max(80).optional(),
    service: z.string().trim().max(80).optional(),
    status: z.enum(['ACTIVE', 'NOT_WORKING', 'EXPIRED', 'NEEDS_RECONNECTING']).optional(),
    bot_id: z.string().uuid().optional(),
});
export type CredentialQuery = z.infer<typeof CredentialQuerySchema>;
