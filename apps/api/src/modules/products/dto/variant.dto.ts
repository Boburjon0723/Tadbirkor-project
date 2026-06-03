import { IsString, IsNotEmpty, IsOptional, IsNumber, IsObject, IsEnum, Min } from 'class-validator';

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @Min(0)
  salePrice: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  purchasePrice?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsObject()
  @IsOptional()
  attributes?: Record<string, any>;

  @IsString()
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: string;

  // For initial setup
  @IsNumber()
  @IsOptional()
  initialStock?: number;

  @IsString()
  @IsOptional()
  warehouseId?: string;
}

export class UpdateVariantDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  salePrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  purchasePrice?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsObject()
  @IsOptional()
  attributes?: Record<string, any>;

  @IsString()
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: string;
}

export class UpdatePriceDto {
  @IsNumber()
  @Min(0)
  salePrice: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  purchasePrice?: number;
}
