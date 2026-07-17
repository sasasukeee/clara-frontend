import { IsUUID } from 'class-validator';

export class AdminFullUserDto {
  @IsUUID()
  id!: string;
}
