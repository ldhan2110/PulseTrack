import { IsString, IsOptional, MinLength, MaxLength, IsDateString } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  planStart?: string;

  @IsOptional()
  @IsDateString()
  planEnd?: string;
}
