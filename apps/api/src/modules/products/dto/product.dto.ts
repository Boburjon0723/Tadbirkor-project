import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  ValidateIf,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateVariantDto } from './variant.dto';

/** PATCH /products/:id — mavjud variant zaxirasini bir tranzaksiyada tuzatish */
export class ProductSaveStockAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsString()
  @IsNotEmpty()
  productVariantId: string;

  /** Musbat = kirim, manfiy = chiqim */
  @IsNumber()
  quantity: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  partnerLedgerContactId?: string;
}

class UpsertVariantDto extends CreateVariantDto {
  @IsString()
  @IsOptional()
  id?: string;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['GOODS', 'SERVICE', 'RAW_MATERIAL', 'FINISHED_GOOD'])
  type: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  imageUrl?: string | null;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['GOODS', 'SERVICE', 'RAW_MATERIAL', 'FINISHED_GOOD'])
  type?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpsertVariantDto)
  variants?: UpsertVariantDto[];

  /** UI dan o‘chirilgan variant ID lari (xavfsiz o‘chirish) */
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  removedVariantIds?: string[];

  /**
   * Tahrirlashda zaxira o‘zgarishi — mahsulot + variant + stock bir PATCH da.
   * Faqat mavjud variantlar (id bor) uchun.
   */
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProductSaveStockAdjustmentDto)
  stockAdjustments?: ProductSaveStockAdjustmentDto[];
}
