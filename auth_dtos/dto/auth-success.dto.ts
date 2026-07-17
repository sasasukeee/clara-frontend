import { ApiProperty } from '@nestjs/swagger';

export class AuthSuccessResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
