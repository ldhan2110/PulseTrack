import { IsInt, IsOptional, IsString, Min, Max, IsDateString } from 'class-validator';

// Editable fields of a time log. `progress` is deliberately absent: it is a
// snapshot taken at logging time, and editing it would silently overwrite the
// task's current progress.
export class UpdateTimeLogDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes?: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsDateString()
  loggedAt?: string;
}
