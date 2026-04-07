import { IsString, MaxLength } from 'class-validator';

export class UpdateProjectContextDto {
  @IsString()
  @MaxLength(2000)
  projectContext: string;
}
