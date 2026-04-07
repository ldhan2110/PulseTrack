import { IsInt, IsOptional, IsString, Min, Max, IsDateString } from 'class-validator';

export class CreateTimeLogDto {
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsDateString()
  loggedAt?: string;
}
