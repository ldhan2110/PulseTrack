// apps/api/src/ai-wbs-generation/dto/generate-wbs.dto.ts
import { IsString, IsOptional, IsArray, IsNumber, IsDateString, MinLength, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class GenerateWbsDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  instructions?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => typeof value === 'string' ? parseInt(value, 10) : value)
  teamSize?: number;

  @IsOptional()
  @IsArray()
  teamRoles?: { role: string; count: number }[];

  @IsOptional()
  @IsDateString()
  projectStartDate?: string;

  @IsOptional()
  @IsDateString()
  targetEndDate?: string;

  @IsOptional()
  @IsString()
  methodology?: 'agile' | 'waterfall' | 'hybrid';

  @IsOptional()
  @IsString()
  sprintDuration?: '1-week' | '2-weeks' | '3-weeks';
}

export class WbsChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message: string;

  @IsArray()
  currentWbs: any[];

  @IsOptional()
  @IsArray()
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export interface WbsGenerationJobData {
  projectId: string;
  userId: string;
  instructions?: string;
  features: string[];
  teamSize?: number;
  teamRoles?: { role: string; count: number }[];
  projectStartDate?: string;
  targetEndDate?: string;
  methodology?: string;
  sprintDuration?: string;
  uploadedFilePaths: string[];
}

export interface WbsGenerationJobResult {
  phases: any[];
}
