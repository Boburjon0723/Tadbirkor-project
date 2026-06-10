import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdatePosReceiptSettingsDto {
  @IsOptional()
  @IsBoolean()
  autoPrint?: boolean;

  @IsOptional()
  @IsEnum(['thermal', 'a4', 'none'])
  receiptFormat?: 'thermal' | 'a4' | 'none';
}
