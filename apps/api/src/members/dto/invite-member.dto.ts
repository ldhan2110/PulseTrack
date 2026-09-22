import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  roleId: string;

  // When true, provision an EXTERNAL (PulseTrack password) customer instead of
  // a pending Keycloak invite; the invitee gets a set-password link.
  @IsOptional()
  @IsBoolean()
  external?: boolean;
}
