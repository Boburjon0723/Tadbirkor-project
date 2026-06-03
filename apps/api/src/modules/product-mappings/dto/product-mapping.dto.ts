import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, IsEnum } from "class-validator";

export class CreateProductMappingDto {
  @IsString()
  @IsNotEmpty()
  partnerCompanyId: string;

  @IsString()
  @IsNotEmpty()
  partnerProductName: string;

  @IsString()
  @IsOptional()
  partnerSku?: string;

  @IsString()
  @IsOptional()
  partnerBarcode?: string;

  @IsString()
  @IsNotEmpty()
  ownProductVariantId: string;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  conversionRatio?: number;

  @IsString()
  @IsOptional()
  unitMapping?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: string;
}

export class UpdateProductMappingDto {
  @IsString()
  @IsOptional()
  partnerProductName?: string;

  @IsString()
  @IsOptional()
  partnerSku?: string;

  @IsString()
  @IsOptional()
  partnerBarcode?: string;

  @IsString()
  @IsOptional()
  ownProductVariantId?: string;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  conversionRatio?: number;

  @IsString()
  @IsOptional()
  unitMapping?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: string;
}
