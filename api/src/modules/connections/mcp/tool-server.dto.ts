import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export const ToolServerAuthKinds = { NONE: 'NONE', TOKEN: 'TOKEN', OAUTH: 'OAUTH' } as const;
export type ToolServerAuthKind = (typeof ToolServerAuthKinds)[keyof typeof ToolServerAuthKinds];
const AUTH_KINDS = Object.values(ToolServerAuthKinds);

export class CreateToolServerDto {
    @ApiProperty({ example: 'Company CRM tools' }) @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiProperty({ example: 'https://tools.example.com/mcp' }) @IsString() @MaxLength(500) url: string;
    @ApiProperty({ enum: AUTH_KINDS, description: 'No sign-in, an access token, or the server\'s own sign-in screen' })
    @IsIn(AUTH_KINDS)
    auth_kind: ToolServerAuthKind;
    @ApiPropertyOptional({ description: 'TOKEN only — handed straight to Composio, never stored by Agent Space' })
    @ValidateIf((o) => o.auth_kind === ToolServerAuthKinds.TOKEN)
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
    @ApiPropertyOptional({ description: 'OAUTH only: where the sign-in returns (app deep link); defaults to /connections/callback' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    return_url?: string;
}

/** The address and sign-in type can't change: the server is registered with Composio under them. */
export class UpdateToolServerDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
    @ApiPropertyOptional({ enum: ['PRIVATE', 'SHARED'] }) @IsOptional() @IsIn(['PRIVATE', 'SHARED']) visibility?: 'PRIVATE' | 'SHARED';
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true }) bot_ids?: string[];
}

export class ToolServerTokenDto {
    @ApiProperty() @IsString() @MinLength(4) @MaxLength(8000) token: string;
}

export class ToolServerSignInDto {
    @ApiPropertyOptional({ description: 'Where the sign-in returns (app deep link); defaults to /connections/callback' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    return_url?: string;
}
