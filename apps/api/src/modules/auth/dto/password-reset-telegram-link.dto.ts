import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class PasswordResetTelegramLinkDto {
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value).trim()))
  login?: string;
}
