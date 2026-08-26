import { IsString, IsUrl, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class CreateRepositoryDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true }, { message: 'Must be a valid URL (e.g., https://gitlab.company.com/team/repo.git)' })
  repoUrl: string;

  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @IsString()
  @IsIn(['github', 'gitlab'])
  @IsOptional()
  provider?: string;

  @IsString()
  @IsOptional()
  branch?: string;
}
