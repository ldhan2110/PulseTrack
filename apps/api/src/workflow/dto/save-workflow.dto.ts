import {
  IsString,
  IsBoolean,
  IsInt,
  IsOptional,
  IsArray,
  IsIn,
  ValidateNested,
  Min,
  MaxLength,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WorkflowStatusDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(50)
  name: string;

  @IsString()
  @MaxLength(30)
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'key must be uppercase with underscores' })
  key: string;

  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a hex color like #ff0000' })
  color: string;

  @IsInt()
  @Min(0)
  position: number;

  @IsBoolean()
  isDefault: boolean;

  @IsBoolean()
  isClosed: boolean;

  @IsOptional()
  @IsIn(['actualStartDate', 'actualEndDate', 'plannedStartDate', 'plannedEndDate', null])
  autoDateField?: string | null;

  @IsOptional()
  @IsIn(['set', 'clear', null])
  autoDateAction?: string | null;
}

export class WorkflowTransitionDto {
  @IsString()
  fromStatusKey: string;

  @IsString()
  toStatusKey: string;
}

export class StatusAssigneeRuleDto {
  @IsString()
  statusKey: string;

  @IsArray()
  @IsString({ each: true })
  memberIds: string[];
}

export class SaveWorkflowDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStatusDto)
  statuses: WorkflowStatusDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionDto)
  transitions: WorkflowTransitionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusAssigneeRuleDto)
  assigneeRules: StatusAssigneeRuleDto[];

  @IsOptional()
  layout?: Record<string, unknown>;
}
