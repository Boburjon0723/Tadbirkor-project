import { IsNotEmpty, IsString } from 'class-validator';

export class RejectFieldTaskDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
