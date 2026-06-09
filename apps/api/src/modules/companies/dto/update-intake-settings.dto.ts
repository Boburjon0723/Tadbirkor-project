import { IsBoolean, IsEnum, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';

export class UpdateIntakeSettingsDto {
  @IsOptional()
  @IsEnum(['SINGLE_SCAN_QTY', 'EACH_SCAN_ONE'])
  scanMode?: 'SINGLE_SCAN_QTY' | 'EACH_SCAN_ONE';

  @IsOptional()
  @IsBoolean()
  allowBulkQty?: boolean;

  @IsOptional()
  @IsBoolean()
  allowQuickProduct?: boolean;

  /** null yuborish = cheksiz */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  maxQtyPerScan?: number | null;
}
