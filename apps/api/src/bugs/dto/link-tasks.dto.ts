import { IsArray, IsString } from 'class-validator';

export class LinkTasksDto {
  @IsArray()
  @IsString({ each: true })
  taskIds: string[];
}
