import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateSubTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  workflowStatusId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}
