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

export class SetServiceDefaultDto {
    @ApiProperty() @IsString() service_key: string;
    @ApiProperty() @IsUUID() connection_id: string;
}

class SecretRequestRefDto {
    @ApiProperty() @IsUUID() run_id: string;
    @ApiProperty() @IsString() request_id: string;
}

/** §8.8 — the secure secret box posts here directly; the value never goes through the chat stream or the model. */
export class CreateCredentialDto {
    @ApiProperty({ example: 'Mailchimp – Marketing' }) @IsString() @MinLength(1) @MaxLength(80) label: string;
    @ApiPropertyOptional({ example: 'Mailchimp' }) @IsOptional() @IsString() @MaxLength(60) service_name?: string;
    @ApiProperty({ enum: ['api_key', 'mcp_token'] }) @IsIn(['api_key', 'mcp_token']) kind: 'api_key' | 'mcp_token';
    @ApiProperty() @IsString() @MinLength(6) @MaxLength(8000) value: string;
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
    @ApiProperty() @IsString() @MinLength(6) @MaxLength(8000) value: string;
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
