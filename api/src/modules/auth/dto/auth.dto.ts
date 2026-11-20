import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class RegisterDto {
    @ApiProperty({ example: 'petros@acme.com' }) @Transform(normalizeEmail) @IsEmail() @MaxLength(254) email: string;
    @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8, { message: 'Password must be at least 8 characters' }) @MaxLength(128) password: string;
    @ApiProperty({ example: 'Petros' }) @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiPropertyOptional({ example: 'Europe/Athens' }) @IsOptional() @IsString() @MaxLength(64) timezone?: string;
    @ApiPropertyOptional({ description: 'Invitation token to accept right after sign-up (§5.2)' }) @IsOptional() @IsString() invitation_token?: string;
}

export class LoginDto {
    @ApiProperty() @Transform(normalizeEmail) @IsEmail() email: string;
    @ApiProperty() @IsString() @MinLength(1) password: string;
}

export class RefreshDto {
    @ApiPropertyOptional({ description: 'Native apps send the refresh token in the body; the web app uses the httpOnly cookie' })
    @IsOptional() @IsString() refresh_token?: string;
}

export class DeviceInfoDto {
    @ApiPropertyOptional({ enum: ['WEB', 'DESKTOP', 'ANDROID'] }) @IsOptional() @IsIn(['WEB', 'DESKTOP', 'ANDROID']) platform?: 'WEB' | 'DESKTOP' | 'ANDROID';
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) app_version?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) device_name?: string;
}

export class ForgotPasswordDto {
    @ApiProperty() @Transform(normalizeEmail) @IsEmail() email: string;
}

export class ResetPasswordDto {
    @ApiProperty() @IsString() @MinLength(10) token: string;
    @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(128) password: string;
}

export class ChangePasswordDto {
    @ApiProperty() @IsString() current_password: string;
    @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(128) new_password: string;
}
