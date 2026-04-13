import { IsString, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { PlannerSessionStatus } from '@prisma/client';

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(PlannerSessionStatus)
  status?: PlannerSessionStatus;
}
