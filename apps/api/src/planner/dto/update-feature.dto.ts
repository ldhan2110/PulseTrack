import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateFeatureDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
