import {
  IsBoolean,
  IsOptional,
  IsString,
  IsArray,
  IsInt,
  IsIn,
  Matches,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';

export class UpsertReportConfigDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  googleChatEnabled?: boolean;

  @IsOptional()
  @IsString()
  googleChatWebhookUrl?: string;

  @IsOptional()
  @IsIn(['all', 'roles', 'members'])
  recipientMode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientRoles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientMembers?: string[];

  @IsOptional()
  @IsIn(['daily', 'weekly', 'custom'])
  frequency?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayMaxSize(7)
  scheduleDays?: number[];

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'scheduleTime must be in HH:mm format' })
  scheduleTime?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
