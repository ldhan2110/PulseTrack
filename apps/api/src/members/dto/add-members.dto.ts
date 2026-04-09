import { ArrayMinSize, IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MemberEntryDto {
  @IsString()
  userId: string;

  @IsString()
  roleId: string;
}

export class AddMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MemberEntryDto)
  members: MemberEntryDto[];
}
