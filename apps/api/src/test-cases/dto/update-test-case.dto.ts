import {
  IsString, IsOptional, IsEnum, IsArray, IsInt, Min,
  MinLength, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Priority, TestCaseStatus } from '@prisma/client';
import { TestCaseStepDto, TestCaseLinkDto } from './create-test-case.dto';

export class UpdateTestCaseDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

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
  @IsEnum(TestCaseStatus)
  status?: TestCaseStatus;

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
  moduleId?: string;

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
