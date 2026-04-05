import { IsEnum } from 'class-validator';
import { ProjectRole } from '@prisma/client';

export class ChangeRoleDto {
  @IsEnum(ProjectRole)
  role: ProjectRole;
}
