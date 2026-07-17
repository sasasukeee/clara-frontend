import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ProviderUserDto {
  @ApiProperty({ example: 'user@gmail.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({ example: 'user' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(32)
  username?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;
}

class ProviderInfoDto {
  @ApiProperty({
    example: 'google',
    description: 'Desteklenen sağlayıcılar: google (apple/github ileride)',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsIn(['google', 'apple', 'github'])
  @MaxLength(50)
  provider!: string;

  @ApiProperty({
    example: '109876543210987654321',
    description: 'Sağlayıcı kullanıcı ID’si',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  providerUserId!: string;

  @ApiPropertyOptional({ example: 'user@gmail.com' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(255)
  providerEmail?: string;

  @ApiPropertyOptional({ example: 'User Name' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  providerName?: string;

  @ApiPropertyOptional({
    example: 'https://avatar.url',
    description: 'Sağlayıcıdan dönen avatar URL’si',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsUrl()
  @MaxLength(2048)
  providerAvatarUrl?: string;
}

export class CreateUserWithProviderDto {
  @ApiProperty({ type: ProviderUserDto })
  @ValidateNested()
  @Type(() => ProviderUserDto)
  user!: ProviderUserDto;

  @ApiProperty({ type: ProviderInfoDto })
  @ValidateNested()
  @Type(() => ProviderInfoDto)
  provider!: ProviderInfoDto;
}
