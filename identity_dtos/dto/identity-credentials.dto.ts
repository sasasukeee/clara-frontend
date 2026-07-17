import { ApiProperty } from '@nestjs/swagger';

export class IdentityCredentialsDto {
  @ApiProperty({
    example: 'jane.doe',
    description: 'Kullanıcı adı',
  })
  username!: string;

  @ApiProperty({
    example: 'StrongPassw0rd!',
    description: 'Parola',
  })
  password!: string;
}
