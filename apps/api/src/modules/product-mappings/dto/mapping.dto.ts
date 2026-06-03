import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateProductMappingDto {
  @IsString()
  @IsNotEmpty()
  partnerId: string;

  @IsString()
  @IsNotEmpty()
  partnerProductName: string;

  @IsString()
  @IsOptional()
  partnerSku?: string;

  @IsString()
  @IsNotEmpty()
  ownProductVariantId: string;

  @IsNumber()
  @IsOptional()
  conversionRatio?: number;
}
