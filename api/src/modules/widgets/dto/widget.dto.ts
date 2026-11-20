import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** Save an interactive reply (§7.4) from a message as a widget. */
export class CreateWidgetDto {
    @ApiProperty({ description: 'Message that holds the interactive reply' }) @IsUUID() message_id: string;
    @ApiProperty({ description: 'The interactive reply part id (ui_…)' }) @IsString() @MinLength(1) @MaxLength(64) ui_id: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
}

export class UpdateWidgetDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
    @ApiPropertyOptional({ description: 'What the bot is asked each time the widget is refreshed' }) @IsOptional() @IsString() @MinLength(1) @MaxLength(2000) refresh_prompt?: string;
}
