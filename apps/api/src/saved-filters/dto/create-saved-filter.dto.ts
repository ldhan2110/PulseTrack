import { IsString, IsIn, IsObject, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class CreateSavedFilterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsIn(['task', 'bug'])
  entityType: string;

  @IsObject()
  filters: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
