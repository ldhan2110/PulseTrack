import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsNotEmpty, ArrayNotEmpty, IsDateString } from 'class-validator';

export const MCP_SCOPES = [
  'tasks:read',
  'bugs:read',
  'tasks:write',
  'tasks:logtime',
  'tasks:attach',
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
  @IsBoolean()
  allowWrite?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
