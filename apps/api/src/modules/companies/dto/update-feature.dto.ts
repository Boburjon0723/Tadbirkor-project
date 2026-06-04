import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateFeatureDto {
  /** Butun modul (barcha feature lar) */
  @IsOptional()
  @IsString()
  moduleKey?: string;

  /** Bitta ombor bo‘limi (masalan WAREHOUSE_PICKING) */
  @IsOptional()
  @IsString()
  featureKey?: string;

  /** Guruh: core | b2b_outbound | inventory_count | all */
  @IsOptional()
  @IsString()
  bundleId?: string;

  @IsBoolean()
  enabled: boolean;
}

