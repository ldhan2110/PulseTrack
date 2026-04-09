import {
  IsString, IsOptional, IsEnum, IsArray, IsInt, Min,
  MinLength, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Priority } from '@prisma/client';

export class TestCaseStepDto {
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

export class TestCaseLinkDto {
  @IsString()
  entityType: string;

  @IsString()
  entityId: string;
}

export class CreateTestCaseDto {
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

  @IsString()
  moduleId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseStepDto)
  steps?: TestCaseStepDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseLinkDto)
  links?: TestCaseLinkDto[];
}
