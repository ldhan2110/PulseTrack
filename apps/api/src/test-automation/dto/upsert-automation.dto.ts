import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpsertAutomationDto {
  @IsString()
  script: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(5000)
  @Max(120000)
  timeoutMs?: number;
}
