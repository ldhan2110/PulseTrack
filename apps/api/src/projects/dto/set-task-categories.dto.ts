import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TaskCategoryItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsBoolean()
  isActive: boolean;
}

export class SetTaskCategoriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskCategoryItemDto)
  categories: TaskCategoryItemDto[];
}
