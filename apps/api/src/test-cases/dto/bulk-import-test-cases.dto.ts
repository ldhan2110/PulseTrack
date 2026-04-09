import {
  IsString, IsOptional, IsEnum, IsArray, IsInt, Min,
  MinLength, MaxLength, ValidateNested, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Priority } from '@prisma/client';

class BulkImportStepDto {
  @IsInt()
  @Min(0)
  position: number;

  @IsString()
  @MaxLength(2000)
  action: string;

  @IsString()
  @MaxLength(2000)
  expectedResult: string;
}

export class BulkImportTestCaseItemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  preconditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  expectedResult?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;

  @IsOptional()
  @IsString()
  moduleName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportStepDto)
  steps?: BulkImportStepDto[];
}

export class BulkImportTestCasesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkImportTestCaseItemDto)
  items: BulkImportTestCaseItemDto[];
}
