import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateAiFixDto {
  @IsString()
  @IsNotEmpty()
  targetBranch: string;

  @IsString()
  @IsOptional()
  guidance?: string;

  @IsBoolean()
  @IsOptional()
  includeTests?: boolean;
}
