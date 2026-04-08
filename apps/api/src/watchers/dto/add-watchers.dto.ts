import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class AddWatchersDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  userIds: string[];
}
