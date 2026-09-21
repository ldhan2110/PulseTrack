import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ReactMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  emoji!: string;
}
