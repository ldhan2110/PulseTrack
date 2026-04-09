import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { TestResultStatus } from '@prisma/client';

export class UpdateResultDto {
  @IsEnum(TestResultStatus)
  result: TestResultStatus;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
