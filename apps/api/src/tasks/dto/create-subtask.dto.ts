import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class CreateSubTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}
