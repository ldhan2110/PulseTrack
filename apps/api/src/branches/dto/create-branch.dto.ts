import { IsString, IsIn, IsOptional, IsNotEmpty } from 'class-validator';

const BRANCH_TYPES = ['feat', 'fix', 'chore', 'hotfix', 'refactor'] as const;

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  repositoryId: string;

  @IsString()
  @IsIn(BRANCH_TYPES)
  branchType: string;

  @IsString()
  @IsOptional()
  sourceBranch?: string;
}
