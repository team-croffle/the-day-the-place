import type { CreateUserPayload } from '@nest-vue/shared';
import { IsEmail, IsString, Length } from 'class-validator';

export class CreateUserDto implements CreateUserPayload {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, 60)
  name!: string;
}
