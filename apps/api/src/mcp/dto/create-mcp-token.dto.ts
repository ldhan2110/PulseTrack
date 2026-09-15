import { IsArray, IsIn, IsOptional, IsString, IsNotEmpty, ArrayNotEmpty, IsDateString } from 'class-validator';

export const MCP_SCOPES = [
  'tasks:read',
  'bugs:read',
  'tasks:write',
  'tasks:logtime',
  'testcases:read',
  'testcases:write',
  'testexec:read',
  'testexec:write',
] as const;

export class CreateMcpTokenDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(MCP_SCOPES, { each: true })
  scopes!: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
