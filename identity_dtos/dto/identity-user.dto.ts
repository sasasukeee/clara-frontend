import { ApiProperty } from '@nestjs/swagger';

export class IdentityUserDto {
  @ApiProperty({ example: 'usr_01HX...', description: 'Kullanıcı ID' })
  userId!: string;

  @ApiProperty({ example: 'jane.doe', required: false })
  username?: string;

  @ApiProperty({ example: 'jane@example.com', required: false })
  email?: string;

  @ApiProperty({
    description: 'Ek alanlar',
    required: false,
    type: Object,
    additionalProperties: true,
  })
  extra?: Record<string, unknown>;
}
