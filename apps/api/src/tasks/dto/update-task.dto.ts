import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsDateString,
  Min,
  Max,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Priority } from '@prisma/client';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  workflowStatusId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  storyPoints?: number;

  @IsOptional()
  @IsString()
  sprintId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  acceptanceCriteria?: string;

  @IsOptional()
  @ValidateIf(o => o.priority !== null)
  @IsEnum(Priority)
  priority?: Priority | null;

  @IsOptional()
  @ValidateIf(o => o.plannedStartDate !== null)
  @IsDateString()
  plannedStartDate?: string | null;

  @IsOptional()
  @ValidateIf(o => o.plannedEndDate !== null)
  @IsDateString()
  plannedEndDate?: string | null;

  @IsOptional()
  @ValidateIf(o => o.actualStartDate !== null)
  @IsDateString()
  actualStartDate?: string | null;

  @IsOptional()
  @ValidateIf(o => o.actualEndDate !== null)
  @IsDateString()
  actualEndDate?: string | null;
}
