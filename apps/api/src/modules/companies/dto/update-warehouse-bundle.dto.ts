import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateWarehouseBundleDto {
  @IsString()
  @IsNotEmpty()
  bundleId: string;

  @IsBoolean()
  enabled: boolean;
}
