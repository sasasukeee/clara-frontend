import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetUserByEmailDto {
  @ApiProperty({ example: 'hasan@gmail.com' })
  @Transform(({ value }) => value?.trim())
  @MaxLength(254)
  @IsEmail()
  email!: string;
}
