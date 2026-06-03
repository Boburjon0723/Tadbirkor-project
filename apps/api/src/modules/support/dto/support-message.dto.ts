import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitSupportMessageDto {
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  topic?: string;
}
