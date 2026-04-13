import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
