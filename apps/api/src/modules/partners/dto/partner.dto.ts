import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class PartnerRequestDto {
  @IsString()
  @IsOptional()
  partnerTin?: string;

  @IsString()
  @IsOptional()
  partnerCompanyId?: string;
}

export class PartnerWarehouseVisibilityDto {
  @IsBoolean()
  allVisible!: boolean;

  @IsArray()
  @IsOptional()
  warehouseIds?: string[];
}
