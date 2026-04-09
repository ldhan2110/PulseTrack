import { IsString, IsOptional, IsArray, MinLength, MaxLength } from 'class-validator';

export class CreateTestExecutionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsString()
  assigneeId: string;

  @IsOptional()
  @IsString()
  sprintId?: string;

  @IsOptional()
  @IsString()
  suiteId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  testCaseIds?: string[];
}
