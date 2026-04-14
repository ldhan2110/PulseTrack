import { IsString, IsEnum } from 'class-validator';

enum WbsNodeType {
  TASK = 'TASK',
  SUBTASK = 'SUBTASK',
}

export class CreateDependencyDto {
  @IsString()
  sourceId: string;

  @IsEnum(WbsNodeType)
  sourceType: WbsNodeType;

  @IsString()
  targetId: string;

  @IsEnum(WbsNodeType)
  targetType: WbsNodeType;
}
