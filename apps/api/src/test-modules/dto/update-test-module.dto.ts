import { IsString, IsOptional, IsInt, MinLength, MaxLength } from 'class-validator';

export class UpdateTestModuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsString()
  parentId?: string;
}
