import { IsString, IsNotEmpty, IsIn, IsOptional, IsArray, ArrayNotEmpty } from 'class-validator';

export class UpsertWikiConfigDto {
  @IsString()
  @IsNotEmpty()
  wikiPath: string;

  @IsOptional()
  @IsString()
  @IsIn(['manual', 'on-pull', 'scheduled'])
  autoUpdate?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  sections?: string[];
}
