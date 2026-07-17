import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class GoogleCallbackDto {
  @ApiProperty({
    description: 'Google id_token (JWT)',
    example: 'eyJhbGciOiJSUzI1NiIs...',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  id_token!: string;
}
