import { IsString, IsObject, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class UpdateSavedFilterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
