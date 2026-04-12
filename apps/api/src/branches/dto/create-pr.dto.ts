import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePrDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsOptional()
  targetBranch?: string;
}
