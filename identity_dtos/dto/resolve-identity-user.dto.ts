import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResolveIdentityUserDto {
  @ApiPropertyOptional({
    example: 'google',
    description: 'OAuth provider adı (örn: google)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(50)
  provider?: string;

  @ApiPropertyOptional({
    example: '109876543210987654321',
    description: 'Sağlayıcının kullanıcı ID’si',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  providerUserId?: string;

  @ApiPropertyOptional({
    example: 'user@gmail.com',
    description: 'Email (provider bilgisi yoksa fallback)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email?: string;
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  emailVerified?: boolean;
}

export type IdentityResolveStatus =
  | 'FOUND_BY_PROVIDER'
  | 'FOUND_BY_EMAIL'
  | 'NOT_FOUND';

export interface IdentityResolveResponse {
  status: IdentityResolveStatus;
  userId?: string;
}

export class IdentityResolveResponseDto {
  @ApiProperty({
    enum: ['FOUND_BY_PROVIDER', 'FOUND_BY_EMAIL', 'NOT_FOUND'],
  })
  status!: IdentityResolveStatus;

  @ApiPropertyOptional({
    example: 'a3b7d93e-4b7f-4e6c-b5de-ffdd9b81b9b9',
    description: 'Kullanıcı bulunduysa ID',
  })
  userId?: string;
}
