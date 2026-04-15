import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';

export class BulkDeleteTestExecutionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];
}
