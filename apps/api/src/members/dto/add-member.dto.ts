import { IsEnum, IsString } from 'class-validator';
import { ProjectRole } from '@prisma/client';

export class AddMemberDto {
  @IsString()
  userId: string;

  @IsEnum(ProjectRole)
  role: ProjectRole;
}
