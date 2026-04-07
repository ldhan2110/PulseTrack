import { IsString, IsUrl, IsNotEmpty } from 'class-validator';

export class UpsertRepositoryConfigDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true }, { message: 'Must be a valid URL (e.g., https://gitlab.company.com/team/repo.git)' })
  repoUrl: string;

  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
