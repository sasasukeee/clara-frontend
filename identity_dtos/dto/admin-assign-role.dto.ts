import {
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class AdminAssignRoleDto {
  @IsUUID()
  @IsNotEmpty()
  roleId: string;
}
