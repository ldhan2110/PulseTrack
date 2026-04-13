import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class UpsertPlannerAiConfigDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['openrouter'])
  provider: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  apiKey?: string;
}
