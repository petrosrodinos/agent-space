import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class AddKnowledgeDto {
    @ApiProperty({ enum: ['FILE', 'LINK', 'TEXT'] }) @IsIn(['FILE', 'LINK', 'TEXT']) kind: 'FILE' | 'LINK' | 'TEXT';
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
    @ApiPropertyOptional({ description: 'FILE: an uploaded file (purpose "knowledge")' }) @ValidateIf((o) => o.kind === 'FILE') @IsUUID() file_id?: string;
    @ApiPropertyOptional({ description: 'LINK: a web page to read' }) @ValidateIf((o) => o.kind === 'LINK') @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }) url?: string;
    @ApiPropertyOptional({ description: 'TEXT: notes, FAQs, policies' }) @ValidateIf((o) => o.kind === 'TEXT') @IsString() @MaxLength(100_000) content?: string;
}

export class UpdateKnowledgeDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
    @ApiPropertyOptional({ description: 'The text bots read. Editable for notes, files (extracted text) and web pages (fetched text).' }) @IsOptional() @IsString() @MaxLength(400_000) content?: string;
    @ApiPropertyOptional({ description: 'LINK only: the web page address. Changing it re-reads the page unless content is sent too.' }) @IsOptional() @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }) url?: string;
}
