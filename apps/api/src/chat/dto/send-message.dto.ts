import { IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  body?: string;

  // Echoed back on the broadcast so the sender can dedupe its optimistic message.
  @IsOptional()
  @IsString()
  clientTempId?: string;
}
