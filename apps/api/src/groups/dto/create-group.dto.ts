import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
