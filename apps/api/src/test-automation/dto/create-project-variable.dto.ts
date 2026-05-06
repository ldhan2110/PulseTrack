import { IsString, IsBoolean, IsOptional, Matches } from 'class-validator';

export class CreateProjectVariableDto {
  @IsString()
  @Matches(/^[A-Z_][A-Z0-9_]*$/, {
    message: 'key must be UPPER_SNAKE_CASE',
  })
  key: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}

export class UpdateProjectVariableDto {
  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}
