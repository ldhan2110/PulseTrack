import { IsString, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { BugSeverity } from '@prisma/client';

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
  @MaxLength(5000)
  reproductionSteps?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  environment?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}
