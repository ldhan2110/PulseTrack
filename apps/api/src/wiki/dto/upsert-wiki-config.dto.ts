import { IsString, IsOptional, IsIn, IsArray } from 'class-validator';

export class UpsertWikiConfigDto {
  @IsOptional()
  @IsString()
  @IsIn(['manual', 'on-pull', 'scheduled'])
  autoUpdate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sections?: string[];
}
