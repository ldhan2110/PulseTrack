import { ConversationType } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  @IsOptional()
  @IsString()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  memberIds: string[];
}
