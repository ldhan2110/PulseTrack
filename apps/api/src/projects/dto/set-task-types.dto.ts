import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TaskTypeItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsBoolean()
  isActive: boolean;
}

export class SetTaskTypesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskTypeItemDto)
  types: TaskTypeItemDto[];
}
