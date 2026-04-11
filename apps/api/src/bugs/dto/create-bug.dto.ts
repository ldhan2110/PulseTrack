import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsInt, Min, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { BugSeverity } from '@prisma/client';

export class ReproStepDto {
  @IsInt()
  @Min(0)
  position: number;

  @IsString()
  @MaxLength(2000)
  content: string;
}

export class CreateBugDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

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
  assigneeId?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  parentTaskId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReproStepDto)
  reproSteps?: ReproStepDto[];
}
