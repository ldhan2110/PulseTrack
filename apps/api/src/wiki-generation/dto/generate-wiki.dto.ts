import { IsOptional, IsString } from 'class-validator';

export class TriggerWikiGenerationDto {
  @IsOptional()
  @IsString()
  section?: string;
}

export interface WikiGenerationJobData {
  projectId: string;
  userId: string;
  sections: string[];
}

export interface WikiGenerationJobResult {
  pagesGenerated: number;
  sections: Record<string, number>;
  errors: string[];
}
