import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class UpsertPlannerAiConfigDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['openrouter'])
  provider: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsString()
  @IsNotEmpty()
  apiKey: string;
}
