import { IsString, IsNotEmpty, IsIn, IsOptional, MaxLength } from 'class-validator';

export class UpsertAiConfigDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['claude', 'gemini', 'codex'])
  provider: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  projectContext?: string;
}
