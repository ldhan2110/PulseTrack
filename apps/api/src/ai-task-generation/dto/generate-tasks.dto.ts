// apps/api/src/ai-task-generation/dto/generate-tasks.dto.ts
import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class GenerateTasksDto {
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  prompt: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  scanCodebase?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  breakIntoSubTasks?: boolean;
}

export interface GeneratedTask {
  title: string;
  description: string;
  acceptanceCriteria: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  storyPoints: number;
  subTasks?: GeneratedTask[];
}

export interface GenerationJobData {
  projectId: string;
  userId: string;
  prompt: string;
  scanCodebase: boolean;
  breakIntoSubTasks: boolean;
  uploadedFilePaths: string[];
}

export interface GenerationJobResult {
  tasks: GeneratedTask[];
}
