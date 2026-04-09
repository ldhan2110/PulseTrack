import { IsString, IsOptional, IsInt, MinLength, MaxLength } from 'class-validator';

export class CreateTestModuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsString()
  parentId?: string;
}
