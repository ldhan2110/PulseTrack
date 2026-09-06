import { IsArray, IsString } from 'class-validator';

export class SetDefaultWatchersDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
