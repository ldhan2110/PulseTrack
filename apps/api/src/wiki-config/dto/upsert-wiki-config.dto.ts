import { IsString, IsOptional, IsIn, IsArray, ArrayNotEmpty } from 'class-validator';

export class UpsertWikiConfigDto {
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
