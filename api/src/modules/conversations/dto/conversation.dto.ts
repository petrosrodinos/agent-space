import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { z } from 'zod';

export class CreateDirectDto {
    @ApiProperty() @IsUUID() bot_id: string;
    @ApiPropertyOptional({ description: 'Temporary chats are not saved and create no memories (§7.2)' }) @IsOptional() @IsBoolean() is_temporary?: boolean;
}

export class CreateConversationDto {
    @ApiProperty({ enum: ['GROUP', 'SHARED_BOT'] }) @IsIn(['GROUP', 'SHARED_BOT']) type: 'GROUP' | 'SHARED_BOT';
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) name?: string;
    @ApiPropertyOptional() @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
    @ApiProperty({ isArray: true }) @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) bot_ids: string[];
    @ApiPropertyOptional({ isArray: true }) @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true }) user_ids?: string[];
    @ApiPropertyOptional() @IsOptional() @IsUUID() lead_bot_id?: string;
}

export class UpdateConversationDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) name?: string;
    @ApiPropertyOptional() @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() lead_bot_id?: string | null;
}

export class UpdateMyConversationDto {
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_favourite?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_archived?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_muted?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsUUID() folder_id?: string | null;
}

export class AddParticipantsDto {
    @ApiPropertyOptional({ isArray: true }) @IsOptional() @IsArray() @IsUUID('all', { each: true }) user_ids?: string[];
    @ApiPropertyOptional({ isArray: true }) @IsOptional() @IsArray() @IsUUID('all', { each: true }) bot_ids?: string[];
}

export class SendMessageDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(32000) content: string;
    @ApiPropertyOptional({ isArray: true }) @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUUID('all', { each: true }) file_ids?: string[];
    @ApiPropertyOptional() @IsOptional() @IsUUID() parent_message_id?: string;
    @ApiPropertyOptional({ description: 'Message being replied to (quoted); the bot sees it as context' }) @IsOptional() @IsUUID() reply_to_message_id?: string;
    @ApiPropertyOptional({ description: 'User chose "Send anyway" on the secret warning (§8.8)' }) @IsOptional() @IsBoolean() send_anyway?: boolean;
    @ApiPropertyOptional({ description: 'Client-generated id for optimistic UI' }) @IsOptional() @IsString() @MaxLength(64) client_id?: string;
    @ApiPropertyOptional({ enum: ['TEXT', 'VOICE'] }) @IsOptional() @IsIn(['TEXT', 'VOICE']) source?: 'TEXT' | 'VOICE';
}

export class EditMessageDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(32000) content: string;
    @ApiPropertyOptional({ description: 'Re-run the bot reply after editing' }) @IsOptional() @IsBoolean() rerun?: boolean;
}

export class RetryMessageDto {
    @ApiPropertyOptional({ description: 'Try again with a different model to compare (§6.4)' }) @IsOptional() @IsUUID() model_id?: string;
    @ApiPropertyOptional({ description: '"Try a different approach" — branch (§7.2)' }) @IsOptional() @IsBoolean() branch?: boolean;
}

export class ReactDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(16) emoji: string;
}

export class InteractionDto {
    @ApiProperty() @IsString() @MaxLength(80) component_id: string;
    @ApiProperty() @IsObject() payload: Record<string, unknown>;
}

export class CreateFolderDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(60) name: string;
}

export const MessagesQuerySchema = z.object({
    before: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(40),
    search: z.string().trim().max(200).optional(),
});
export type MessagesQuery = z.infer<typeof MessagesQuerySchema>;

export const ConversationListSchema = z.object({
    archived: z.enum(['true', 'false', '1', '0']).optional().transform((v) => v === 'true' || v === '1'),
    search: z.string().trim().max(200).optional(),
});
export type ConversationListQuery = z.infer<typeof ConversationListSchema>;

export class SaveShareDto {
    @ApiProperty({ enum: ['SNAPSHOT', 'LIVE'], description: 'SNAPSHOT: only messages that exist now. LIVE: new messages show up for viewers too.' }) @IsIn(['SNAPSHOT', 'LIVE']) mode: 'SNAPSHOT' | 'LIVE';
    @ApiPropertyOptional({ description: 'SNAPSHOT only: move the cut-off to now so messages sent since sharing become visible' }) @IsOptional() @IsBoolean() refresh?: boolean;
}

export const SharedConversationQuerySchema = z.object({
    before: z.string().datetime().optional(),
    since: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type SharedConversationQuery = z.infer<typeof SharedConversationQuerySchema>;
