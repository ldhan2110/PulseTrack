import { IsArray, IsEnum, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectRole } from '@prisma/client';

export class MemberEntryDto {
  @IsString()
  userId: string;

  @IsEnum(ProjectRole)
  role: ProjectRole;
}

export class AddMembersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberEntryDto)
  members: MemberEntryDto[];
}
