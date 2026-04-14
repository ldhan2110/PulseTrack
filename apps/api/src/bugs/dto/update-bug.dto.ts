import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsInt, Min, MinLength, MaxLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { BugSeverity } from '@prisma/client';
import { ReproStepDto } from './create-bug.dto';

export class UpdateBugDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  preconditions?: string;

  @IsOptional()
  @IsEnum(BugSeverity)
  severity?: BugSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  environment?: string;

  @IsOptional()
  @IsString()
  expectedResult?: string;

  @IsOptional()
  @IsString()
  actualResult?: string;

  @IsOptional()
  @ValidateIf(o => o.assigneeId !== null)
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @ValidateIf(o => o.ownerId !== null)
  @IsString()
  ownerId?: string | null;

  @IsOptional()
  @IsString()
  parentTaskId?: string;

  @IsOptional()
  @IsString()
  workflowStatusId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReproStepDto)
  reproSteps?: ReproStepDto[];
}
