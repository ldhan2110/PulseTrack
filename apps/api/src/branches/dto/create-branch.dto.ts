import { IsString, IsIn, IsOptional } from 'class-validator';

const BRANCH_TYPES = ['feat', 'fix', 'chore', 'hotfix', 'refactor'] as const;

export class CreateBranchDto {
  @IsString()
  @IsIn(BRANCH_TYPES)
  branchType: string;

  @IsString()
  @IsOptional()
  sourceBranch?: string;
}
