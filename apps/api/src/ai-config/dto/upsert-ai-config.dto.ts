import { IsString, IsNotEmpty, IsIn, IsOptional, IsUrl, MaxLength, ValidateIf } from 'class-validator';

export class UpsertAiConfigDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['claude', 'gemini', 'codex', 'custom'])
  provider: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @ValidateIf((o) => o.provider === 'custom')
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  @IsOptional()
  baseUrl?: string;

  @ValidateIf((o) => o.provider === 'custom')
  @IsOptional()
  @IsIn(['openai', 'anthropic', 'gemini'])
  adapterType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  projectContext?: string;
}
