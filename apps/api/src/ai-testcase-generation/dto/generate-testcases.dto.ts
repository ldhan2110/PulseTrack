// apps/api/src/ai-testcase-generation/dto/generate-testcases.dto.ts
import { IsString, IsOptional, IsBoolean, IsArray, MinLength, MaxLength, ArrayMinSize } from 'class-validator';
import { Transform } from 'class-transformer';

export class GenerateTestCasesDto {
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  prompt: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return [value]; }
    }
    return value;
  })
  taskIds: string[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  generateSteps?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  scanCodebase?: boolean;
}

export interface GeneratedTestCaseStep {
  position: number;
  action: string;
  expectedResult: string;
}

export interface GeneratedTestCase {
  title: string;
  preconditions: string | null;
  expectedResult: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BLOCKER';
  estimatedMinutes: number | null;
  tags: string[];
  suggestedModule: string;
  sourceTaskTitle: string;
  steps?: GeneratedTestCaseStep[];
}

export interface TestCaseGenerationJobData {
  projectId: string;
  userId: string;
  prompt: string;
  taskIds: string[];
  generateSteps: boolean;
  scanCodebase: boolean;
  uploadedFilePaths: string[];
}

export interface TestCaseGenerationJobResult {
  testCases: GeneratedTestCase[];
}
