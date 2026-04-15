import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';

export class BulkDeleteTestCasesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];
}
