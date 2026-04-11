import {
  IsString, IsOptional, IsEnum, IsArray, IsInt, Min,
  MinLength, MaxLength, ValidateNested, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BugSeverity } from '@prisma/client';

class BulkImportReproStepDto {
  @IsInt()
  @Min(0)
  position: number;

  @IsString()
  @MaxLength(2000)
  content: string;
}

export class BulkImportBugItemDto {
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
  description?: string;

  @IsEnum(BugSeverity)
  severity: BugSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  environment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  expectedResult?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  actualResult?: string;

  @IsOptional()
  @IsString()
  statusName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportReproStepDto)
  reproSteps?: BulkImportReproStepDto[];
}

export class BulkImportBugsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkImportBugItemDto)
  items: BulkImportBugItemDto[];
}
