import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { z } from 'zod';

export class SkillQuestionDto {
    @ApiProperty() @IsString() @MaxLength(60) key: string;
    @ApiProperty() @IsString() @MaxLength(300) question: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
}

export class CreateSkillDto {
    @ApiProperty({ example: 'Client onboarding' }) @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiPropertyOptional({ example: '🤝' }) @IsOptional() @IsString() @MaxLength(16) emoji?: string;
    @ApiPropertyOptional({ example: 'client-onboarding' }) @IsOptional() @IsString() @MaxLength(60) slug?: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(1000) description: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(20000) instructions: string;
    @ApiPropertyOptional({ type: [SkillQuestionDto] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => SkillQuestionDto) questions?: SkillQuestionDto[];
    @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) required_services?: string[];
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) result?: string;
}

export class UpdateSkillDto extends PartialType(CreateSkillDto) {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) change_summary?: string;
}

class SkillShareDto {
    @ApiProperty() @IsUUID() user_id: string;
    @ApiProperty({ enum: ['EDITOR', 'USER'] }) @IsIn(['EDITOR', 'USER']) role: 'EDITOR' | 'USER';
}

export class ShareSkillDto {
    @ApiProperty({ enum: ['PRIVATE', 'SPECIFIC_MEMBERS', 'ORGANIZATION'] }) @IsIn(['PRIVATE', 'SPECIFIC_MEMBERS', 'ORGANIZATION']) sharing_level: 'PRIVATE' | 'SPECIFIC_MEMBERS' | 'ORGANIZATION';
    @ApiPropertyOptional({ type: [SkillShareDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SkillShareDto) shares?: SkillShareDto[];
}

export class AssignSkillDto {
    @ApiProperty({ isArray: true }) @IsArray() @IsUUID('all', { each: true }) bot_ids: string[];
}

export class ImportSkillDto {
    @ApiProperty() @IsObject() skill: Record<string, unknown>;
}

export const SkillQuerySchema = z.object({
    tab: z.enum(['all', 'mine', 'shared', 'organization', 'starter', 'deleted']).default('all'),
    search: z.string().trim().max(80).optional(),
});
export type SkillQuery = z.infer<typeof SkillQuerySchema>;

export class SkillFileDto {
    @ApiProperty({ description: 'An uploaded file (purpose "skill")' }) @IsUUID() file_id: string;
}
