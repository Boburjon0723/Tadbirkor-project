import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertTelegramBindingDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['OWNER', 'MANAGER', 'WAREHOUSE', 'ACCOUNTANT', 'SALES'])
  role: string;

  @IsString()
  @IsNotEmpty()
  moduleKey: string;

  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
