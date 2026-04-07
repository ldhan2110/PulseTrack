import { IsString, MaxLength } from 'class-validator';

export class UpdateProjectContextDto {
  @IsString()
  @MaxLength(10000)
  projectContext: string;
}
