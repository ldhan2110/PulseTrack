import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
