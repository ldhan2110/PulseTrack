import { IsString, IsNotEmpty } from 'class-validator';

export class OpenDirectDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
