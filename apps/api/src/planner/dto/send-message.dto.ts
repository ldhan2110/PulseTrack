import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content: string;
}
