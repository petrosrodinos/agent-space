import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateToolServerDto {
    @ApiProperty({ example: 'Company CRM tools' }) @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiProperty({ example: 'https://tools.example.com/mcp' }) @IsString() @MaxLength(500) url: string;
    @ApiProperty({ enum: ['NONE', 'TOKEN', 'OAUTH'], description: 'No sign-in, an access token, or the server\'s own sign-in screen' })
    @IsIn(['NONE', 'TOKEN', 'OAUTH'])
    auth_kind: 'NONE' | 'TOKEN' | 'OAUTH';
    @ApiPropertyOptional({ description: 'TOKEN only — stored in the secret store, never returned' })
    @ValidateIf((o) => o.auth_kind === 'TOKEN')
    @IsString()
    @MinLength(4)
    @MaxLength(8000)
    token?: string;
    @ApiPropertyOptional({ enum: ['PRIVATE', 'SHARED'] }) @IsOptional() @IsIn(['PRIVATE', 'SHARED']) visibility?: 'PRIVATE' | 'SHARED';
    @ApiPropertyOptional({ type: [String], description: 'Limit to these bots (empty = all bots that may use it)' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(100)
    @IsUUID('all', { each: true })
    bot_ids?: string[];
}

export class UpdateToolServerDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) url?: string;
    @ApiPropertyOptional({ enum: ['PRIVATE', 'SHARED'] }) @IsOptional() @IsIn(['PRIVATE', 'SHARED']) visibility?: 'PRIVATE' | 'SHARED';
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true }) bot_ids?: string[];
}

export class ToolServerTokenDto {
    @ApiProperty() @IsString() @MinLength(4) @MaxLength(8000) token: string;
}

export class ToolServerSignInCallbackDto {
    @ApiProperty() @IsString() @MaxLength(200) state: string;
    @ApiProperty() @IsString() @MaxLength(4000) code: string;
}
