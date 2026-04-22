import { IsOptional, IsString } from 'class-validator';

export class CreateFixTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}
