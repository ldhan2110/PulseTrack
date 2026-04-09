import { IsString, IsObject, MinLength, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @IsObject()
  permissions: Record<string, Record<string, boolean>>;
}
