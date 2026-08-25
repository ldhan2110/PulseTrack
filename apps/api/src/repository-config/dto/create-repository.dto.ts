import { IsString, IsUrl, IsNotEmpty, IsIn, IsOptional, Matches } from 'class-validator';

export class CreateRepositoryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'Name must be a safe path segment (letters, digits, -, _)' })
  name: string;

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
