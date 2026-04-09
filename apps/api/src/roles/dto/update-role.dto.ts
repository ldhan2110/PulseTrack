import { IsString, IsObject, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, Record<string, boolean>>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
