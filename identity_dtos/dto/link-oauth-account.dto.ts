import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LinkOauthAccountDto {
  @ApiProperty({
    example: 'a3b7d93e-4b7f-4e6c-b5de-ffdd9b81b9b9',
    description: 'Identity kullanıcı ID',
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    example: 'google',
    enum: ['google', 'apple', 'github'],
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsIn(['google', 'apple', 'github'])
  @MaxLength(50)
  provider!: 'google' | 'apple' | 'github';

  @ApiProperty({
    example: 'sub-1234567890',
    description: 'Sağlayıcı user id (sub)',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  providerUserId!: string;

  @ApiPropertyOptional({
    example: 'user@gmail.com',
    description: 'Sağlayıcıdan gelen email (opsiyonel)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({
    example: true,
    description: 'Sağlayıcı email doğrulandı mı?',
  })
  @IsBoolean()
  emailVerified!: boolean;
}
