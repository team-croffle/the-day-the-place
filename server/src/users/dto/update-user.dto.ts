import { USER_ROLES, type UpdateUserPayload, type UserRole } from '@nest-vue/shared';
import { IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class UpdateUserDto implements UpdateUserPayload {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  name?: string;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;
}
