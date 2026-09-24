import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Prisma } from '@prisma/client';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  prefix?: string;

  // task-form field visibility map: { <fieldKey>: boolean }
  @IsOptional()
  @IsObject()
  fieldConfig?: Prisma.InputJsonValue;
}
