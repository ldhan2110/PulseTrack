// apps/api/src/ai-wbs-generation/dto/generate-wbs.dto.ts
import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, IsDateString, MinLength, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class GenerateWbsDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  instructions?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return [value]; }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => typeof value === 'string' ? parseInt(value, 10) : value)
  teamSize?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return []; }
    }
    return value;
  })
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

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  scanCodebase?: boolean;
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
  scanCodebase: boolean;
  uploadedFilePaths: string[];
}

export interface WbsGenerationJobResult {
  phases: any[];
}
