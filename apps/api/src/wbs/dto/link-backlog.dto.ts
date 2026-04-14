import { IsString } from 'class-validator';

export class LinkBacklogDto {
  @IsString()
  backlogItemId: string;
}
