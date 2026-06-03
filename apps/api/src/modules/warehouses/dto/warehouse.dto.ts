import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: string;

  @IsObject()
  @IsOptional()
  fieldConfig?: {
    showVariantName?: boolean;
    showImage?: boolean;
    showDescription?: boolean;
    showSku?: boolean;
    showBarcode?: boolean;
    showColor?: boolean;
    showTotalStock?: boolean;
    showPurchasePrice?: boolean;
    showSalePrice?: boolean;
  };
}

export class UpdateWarehouseDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: string;

  @IsObject()
  @IsOptional()
  fieldConfig?: {
    showVariantName?: boolean;
    showImage?: boolean;
    showDescription?: boolean;
    showSku?: boolean;
    showBarcode?: boolean;
    showColor?: boolean;
    showTotalStock?: boolean;
    showPurchasePrice?: boolean;
    showSalePrice?: boolean;
  };
}
